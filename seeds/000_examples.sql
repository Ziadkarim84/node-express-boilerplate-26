-- Demo seed for the reference `examples` table shipped with the boilerplate.
-- Delete this file together with the example module.
INSERT INTO `examples` (`name`, `code`, `price`)
VALUES
  ('Sample A', 'SAMPLE-A', 10.00),
  ('Sample B', 'SAMPLE-B', 25.50)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`), `price` = VALUES(`price`);
