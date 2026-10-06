-- Every department DIU lists (daffodilvarsity.edu.bd/departments, 6 October 2026)
-- that the catalog didn't have yet, so uploads and the cover page maker can name
-- them (docs/PLAN.md, decision 41). Browsing pages and the sitemap still show only
-- departments with papers. A department already there under the same name or
-- short name (an admin may have added it) is left as it is.
INSERT INTO `departments` (`name`, `short_name`)
SELECT `name`, `short_name` FROM (
  SELECT column1 AS `name`, column2 AS `short_name` FROM (VALUES
  ('Artificial Intelligence and Data Engineering', 'AIDE'),
  ('Robotics and Mechatronics Engineering', 'RME'),
  ('Finance and Banking', 'FIN'),
  ('Management', 'MGT'),
  ('Marketing', 'MKT'),
  ('Real Estate', 'RE'),
  ('Tourism and Hospitality Management', 'THM'),
  ('Development Studies', 'DS'),
  ('English', 'ENG'),
  ('Information Science and Library Management', 'ISLM'),
  ('Journalism, Media and Communication', 'JMC'),
  ('Law', 'LAW'),
  ('Architecture', 'ARCH'),
  ('Information and Communication Engineering', 'ICE'),
  ('Environmental Science and Disaster Management', 'ESDM'),
  ('Pharmacy', 'PHARM'),
  ('Physical Education and Sports Science', 'PESS'),
  ('Public Health', 'PH'),
  ('ICT Education', 'ICTE'),
  ('Fisheries', 'FISH')
  )
) AS `new`
WHERE NOT EXISTS (
  SELECT 1 FROM `departments` AS `d`
  WHERE lower(`d`.`name`) = lower(`new`.`name`)
    OR lower(`d`.`short_name`) = lower(`new`.`short_name`)
);
