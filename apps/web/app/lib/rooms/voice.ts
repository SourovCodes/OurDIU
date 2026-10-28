import type {
  RoomClientMessage,
  RoomErrorCode,
  RoomServerMessage,
  RoomState,
  RoomVoiceLeftReason,
} from "@ourdiu/shared/rooms";

export type VoiceSnapshot = {
  phase: "idle" | "starting" | "in";
  /** The browser refused the microphone. */
  micBlocked: boolean;
  /** Who's talking right now (by audio level), you included. */
  speaking: ReadonlySet<string>;
  /** People you muted for yourself only. */
  mutedForMe: ReadonlySet<string>;
};

/** The microphone's bitrate: speech at 32 kbps (the rooms' cost estimate assumes it). */
const MIC_BITRATE = 32_000;
const SPEAKING_LEVEL = 0.04;
const NEGOTIATION_TIMEOUT_MS = 10_000;

const LEFT_MESSAGES: Partial<Record<RoomVoiceLeftReason, string>> = {
  moved: "You joined the call from another tab, so this one left it.",
  removed: "An admin took you out of the call.",
  paused: "Voice calls are paused for now, so the call ended.",
};

type Waiter = {
  type: RoomServerMessage["t"];
  resolve: (msg: RoomServerMessage) => void;
  reject: (error: Error) => void;
};

/**
 * Your side of a room's voice call: one RTCPeerConnection to Cloudflare's SFU,
 * which sends your microphone and receives everyone you hear. Offers and answers
 * go through the room's socket. A muted microphone sends nothing at all
 * (`replaceTrack(null)`), and someone is only pulled once they first unmute, so
 * the SFU's egress (what the free allowance counts) follows who's talking.
 */
export class VoiceCall {
  me: string | null = null;
  snapshot: VoiceSnapshot = {
    phase: "idle",
    micBlocked: false,
    speaking: new Set(),
    mutedForMe: new Set(),
  };
  private pc: RTCPeerConnection | null = null;
  private mic: MediaStream | null = null;
  private sender: RTCRtpSender | null = null;
  private waiter: Waiter | null = null;
  /** Negotiations run one at a time. */
  private chain: Promise<void> = Promise.resolve();
  private pulled = new Set<string>();
  private midToUser = new Map<string, string>();
  private audio = new Map<string, HTMLAudioElement>();
  private state: RoomState | null = null;
  private meter: { ctx: AudioContext; analyser: AnalyserNode } | null = null;
  private speakingTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private send: (msg: RoomClientMessage) => boolean,
    private changed: () => void,
    private toast: (message: string) => void,
  ) {}

  /** Asks for the microphone, then joins the call (muted). */
  async join() {
    if (this.snapshot.phase !== "idle") return;
    this.set({ phase: "starting", micBlocked: false });
    try {
      this.mic = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch {
      this.set({ phase: "idle", micBlocked: true });
      return;
    }
    try {
      if (!this.send({ t: "voice.join" })) throw new Error("Not connected");
      await this.waitFor("voice.joined");
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }],
        bundlePolicy: "max-bundle",
      });
      this.pc = pc;
      pc.addEventListener("track", (event) => this.attach(event));
      // The offer carries the microphone, as Cloudflare's own examples do; once
      // connected it's taken off again, since you join muted (`onState` puts it
      // back when you unmute).
      const transceiver = pc.addTransceiver(this.mic!.getAudioTracks()[0]!, {
        direction: "sendonly",
      });
      this.sender = transceiver.sender;
      await pc.setLocalDescription(await pc.createOffer());
      this.send({
        t: "sfu.push",
        sdp: pc.localDescription!.sdp,
        mid: transceiver.mid ?? "0",
      });
      const answer = await this.waitFor("sfu.answer");
      await pc.setRemoteDescription({ type: "answer", sdp: answer.sdp });
      await this.sender.replaceTrack(null);
      const params = this.sender.getParameters();
      if (params.encodings?.[0]) {
        params.encodings[0].maxBitrate = MIC_BITRATE;
        await this.sender.setParameters(params).catch(() => {});
      }
      this.startMeter();
      this.set({ phase: "in" });
      if (this.state) this.onState(this.state);
    } catch (error) {
      this.cleanup();
      if (error instanceof Error && error.message) this.toast(error.message);
    }
  }

  leave() {
    if (this.snapshot.phase === "idle") return;
    this.send({ t: "voice.leave" });
    this.cleanup();
  }

  /** The socket closed: the room has already taken you out of the call. */
  drop() {
    if (this.snapshot.phase === "idle") return;
    this.cleanup();
    this.toast("The connection dropped, so you left the call. Join again.");
  }

  toggleMute() {
    const mine = this.state?.voice.find((v) => v.id === this.me);
    if (!mine) return;
    // Muting is instant; unmuting waits for the room to agree (there's a limit).
    if (!mine.muted) void this.sender?.replaceTrack(null);
    this.send({ t: "voice.mute", muted: !mine.muted });
  }

  toggleMuteForMe(userId: string) {
    const mutedForMe = new Set(this.snapshot.mutedForMe);
    if (!mutedForMe.delete(userId)) mutedForMe.add(userId);
    const el = this.audio.get(userId);
    if (el) el.muted = mutedForMe.has(userId);
    this.set({ mutedForMe });
  }

  onState(state: RoomState) {
    this.state = state;
    if (this.snapshot.phase !== "in" || !this.sender) return;
    const mine = state.voice.find((v) => v.id === this.me);
    const track = this.mic?.getAudioTracks()[0] ?? null;
    const wanted = mine && !mine.muted ? track : null;
    if (this.sender.track !== wanted) void this.sender.replaceTrack(wanted);

    // Hear people from the first time they unmute.
    const toPull = state.voice
      .filter(
        (v) => v.id !== this.me && v.live && !v.muted && !this.pulled.has(v.id),
      )
      .map((v) => v.id);
    if (toPull.length) {
      for (const id of toPull) this.pulled.add(id);
      this.queue(() => this.pull(toPull));
    }
    // People who left: their next session is a new track.
    const inVoice = new Set(state.voice.map((v) => v.id));
    for (const id of [...this.pulled]) {
      if (!inVoice.has(id)) {
        this.pulled.delete(id);
        this.audio.get(id)?.remove();
        this.audio.delete(id);
      }
    }
  }

  onMessage(msg: RoomServerMessage) {
    if (this.waiter?.type === msg.t) {
      const { resolve } = this.waiter;
      this.waiter = null;
      resolve(msg);
      return;
    }
    if (msg.t === "voice.left") {
      if (this.snapshot.phase === "idle") return;
      this.cleanup();
      const message = LEFT_MESSAGES[msg.reason];
      if (message) this.toast(message);
    }
  }

  onError(_code: RoomErrorCode, message: string) {
    if (this.waiter) {
      const { reject } = this.waiter;
      this.waiter = null;
      reject(new Error(message));
      return;
    }
    this.toast(message);
  }

  private async pull(userIds: string[]) {
    const pc = this.pc;
    if (!pc) return;
    this.send({ t: "sfu.pull", userIds });
    const offer = await this.waitFor("sfu.offer").catch(() => null);
    if (!offer || this.pc !== pc) return;
    for (const { mid, userId } of offer.tracks) this.midToUser.set(mid, userId);
    await pc.setRemoteDescription({ type: "offer", sdp: offer.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
    this.send({ t: "sfu.answer", sdp: pc.localDescription!.sdp });
  }

  private attach(event: RTCTrackEvent) {
    const userId = event.transceiver.mid
      ? this.midToUser.get(event.transceiver.mid)
      : undefined;
    if (!userId) return;
    this.audio.get(userId)?.remove();
    const el = document.createElement("audio");
    el.autoplay = true;
    el.srcObject = new MediaStream([event.track]);
    el.muted = this.snapshot.mutedForMe.has(userId);
    el.hidden = true;
    document.body.appendChild(el);
    this.audio.set(userId, el);
  }

  private startMeter() {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      ctx.createMediaStreamSource(this.mic!).connect(analyser);
      this.meter = { ctx, analyser };
    } catch {
      this.meter = null;
    }
    const samples = new Float32Array(512);
    this.speakingTimer = setInterval(() => {
      const speaking = new Set<string>();
      const now = performance.timeOrigin + performance.now();
      for (const receiver of this.pc?.getReceivers() ?? []) {
        const mid = this.pc
          ?.getTransceivers()
          .find((t) => t.receiver === receiver)?.mid;
        const userId = mid ? this.midToUser.get(mid) : undefined;
        if (!userId) continue;
        const loud = receiver
          .getSynchronizationSources()
          .some(
            (s) =>
              (s.audioLevel ?? 0) > SPEAKING_LEVEL && now - s.timestamp < 600,
          );
        if (loud) speaking.add(userId);
      }
      if (this.meter && this.me && this.sender?.track) {
        this.meter.analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (const v of samples) sum += v * v;
        if (Math.sqrt(sum / samples.length) > SPEAKING_LEVEL / 2)
          speaking.add(this.me);
      }
      const before = this.snapshot.speaking;
      if (
        speaking.size !== before.size ||
        [...speaking].some((id) => !before.has(id))
      ) {
        this.set({ speaking });
      }
    }, 250);
  }

  private queue(task: () => Promise<void>) {
    this.chain = this.chain.then(task).catch(() => {});
  }

  private waitFor<T extends RoomServerMessage["t"]>(
    type: T,
  ): Promise<Extract<RoomServerMessage, { t: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.waiter?.type === type) this.waiter = null;
        reject(new Error("The call took too long to connect. Try again."));
      }, NEGOTIATION_TIMEOUT_MS);
      this.waiter = {
        type,
        resolve: (msg) => {
          clearTimeout(timer);
          resolve(msg as Extract<RoomServerMessage, { t: T }>);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      };
    });
  }

  private cleanup() {
    this.waiter?.reject(new Error(""));
    this.waiter = null;
    this.pc?.close();
    this.pc = null;
    this.sender = null;
    for (const track of this.mic?.getTracks() ?? []) track.stop();
    this.mic = null;
    for (const el of this.audio.values()) el.remove();
    this.audio.clear();
    this.pulled.clear();
    this.midToUser.clear();
    if (this.speakingTimer) clearInterval(this.speakingTimer);
    this.speakingTimer = null;
    void this.meter?.ctx.close().catch(() => {});
    this.meter = null;
    this.chain = Promise.resolve();
    this.set({ phase: "idle", speaking: new Set() });
  }

  private set(patch: Partial<VoiceSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.changed();
  }
}
