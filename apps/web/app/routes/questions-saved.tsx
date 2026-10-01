import type { SavedQuestionList } from "@ourdiu/shared";
import { Bookmark, Compass, LogIn } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "~/components/empty-state";
import { QuestionCards } from "~/components/question-cards";
import { SaveButton } from "~/components/save-button";
import { buttonVariants } from "~/components/ui/button";
import { apiGetJson } from "~/lib/api.server";
import { getUser } from "~/lib/session.server";
import { plural } from "~/lib/submissions";
import type { Route } from "./+types/questions-saved";

export const meta: Route.MetaFunction = () => [
  { title: "Saved papers — OurDIU Question Bank" },
  { name: "robots", content: "noindex" },
];

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getUser(request);
  if (!user) return { signedIn: false, items: [] };
  const { items } = await apiGetJson<SavedQuestionList>(
    request,
    "/api/v1/me/saved",
  );
  return { signedIn: true, items };
}

/**
 * The papers the visitor saved: the same list as the app's Saved tab, so it follows
 * them between the website and their phone.
 */
export default function Saved({ loaderData }: Route.ComponentProps) {
  const { signedIn, items } = loaderData;

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="font-display-xl text-5xl sm:text-7xl">Saved</h1>
        <p className="max-w-xl text-muted-foreground">
          {signedIn && items.length > 0
            ? `${plural(items.length, "paper")}, newest first. They’re in the OurDIU app too.`
            : "Papers you save for exam week, here and in the OurDIU app."}
        </p>
      </div>

      {!signedIn ? (
        <EmptyState
          icon={Bookmark}
          shape="quiz"
          title="Keep papers for exam week"
          description="Log in, then tap the bookmark on any paper. Your saved papers follow you between the website and the app."
          action={
            <Link
              to="/login?redirectTo=%2Fquestions%2Fsaved"
              className={buttonVariants()}
            >
              <LogIn aria-hidden />
              Log in
            </Link>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          shape="quiz"
          title="Nothing saved yet"
          description="Tap the bookmark on a paper to keep it here, and in the app."
          action={
            <Link to="/questions/departments" className={buttonVariants()}>
              <Compass aria-hidden />
              Browse papers
            </Link>
          }
        />
      ) : (
        <QuestionCards
          questions={items}
          action={(question) => (
            <SaveButton questionId={question.id} saved signedIn />
          )}
        />
      )}
    </div>
  );
}
