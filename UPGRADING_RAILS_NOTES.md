Todos:
* Fix circle ci to run rails instead of rake for rails tests.
* get bin/docker r bin/rake test:quepid to run `rails test`
* fix FK links
* resolve migration to bigint in mysql for id's
* Test importing ratings, confirm the removal of `case.ratings`.


KEY!   http://railsdiff.org/4.2.11/5.2.4.4


https://www.mccartie.com/tech/2016/12/05/rails-5.1.html
https://dev.to/zealot128/upgrading-rails-from-4-2-to-5-2-6-0-collected-notes-a0o


-- add_foreign_key("annotations", "users")
rake aborted!
ActiveRecord::MismatchedForeignKey: Column `user_id` on table `annotations` does not match column `id` on `users`, which has type `bigint(20)`. To resolve this issue, change the type of the `user_id` column on `annotations` to be :bigint. (For example `t.bigint :user_id`).
Original message: Mysql2::Error: Cannot add foreign key constraint: ALTER TABLE `annotations` ADD CONSTRAINT `fk_rails_4043df79bf`
FOREIGN KEY (`user_id`)
  REFERENCES `users` (`id`)
/usr/local/bundle/gems/mysql2-0.5.3/lib/mysql2/client.rb:131:in `_query'
/usr/local/bundle/gems/mysql2-0.5.3/lib/mysql2/client.rb:131:in `block in query'
/usr/local/bundle/gems/mysql2-0.5.3/lib/mysql2/client.rb:130:in `handle_interrupt'
/usr/local/bundle/gems/mysql2-0.5.3/lib/mysql2/client.rb:130:in `query'


Don't forget to test importing ratings with clear all, I removed a convenicne case.ratings method, so...


This is what the outer joins look like for `for_user` in Rails 4:

SELECT `teams`.* FROM `teams` LEFT OUTER JOIN teams_members on teams_members.team_id = teams.id
LEFT OUTER JOIN users on users.id = teams_members.member_id
WHERE (`teams`.`owner_id` = 1 OR `teams_members`.`member_id` = 1)


SELECT `cases`.`id` AS t0_r0, `cases`.`case_name` AS t0_r1, `cases`.`last_try_number` AS t0_r2, `cases`.`user_id` AS t0_r3, `cases`.`archived` AS t0_r4, `cases`.`scorer_id` AS t0_r5, `cases`.`created_at` AS t0_r6, `cases`.`updated_at` AS t0_r7, `case_metadata`.`id` AS t1_r0, `case_metadata`.`user_id` AS t1_r1, `case_metadata`.`case_id` AS t1_r2, `case_metadata`.`last_viewed_at` AS t1_r3, `teams`.`id` AS t2_r0, `teams`.`name` AS t2_r1, `teams`.`owner_id` AS t2_r2, `teams`.`created_at` AS t2_r3, `teams`.`updated_at` AS t2_r4, `users`.`id` AS t3_r0, `users`.`email` AS t3_r1, `users`.`password` AS t3_r2, `users`.`agreed_time` AS t3_r3, `users`.`agreed` AS t3_r4, `users`.`first_login` AS t3_r5, `users`.`num_logins` AS t3_r6, `users`.`name` AS t3_r7, `users`.`administrator` AS t3_r8, `users`.`reset_password_token` AS t3_r9, `users`.`reset_password_sent_at` AS t3_r10, `users`.`company` AS t3_r11, `users`.`locked` AS t3_r12, `users`.`locked_at` AS t3_r13, `users`.`created_at` AS t3_r14, `users`.`updated_at` AS t3_r15, `users`.`default_scorer_id` AS t3_r16, `users`.`email_marketing` AS t3_r17
FROM `cases`
LEFT OUTER JOIN `case_metadata` ON `case_metadata`.`case_id` = `cases`.`id`
LEFT OUTER JOIN `teams_cases` ON `teams_cases`.`case_id` = `cases`.`id`
LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_cases`.`team_id`
LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
WHERE ((`teams`.`owner_id` = 1 OR `teams_members`.`member_id` = 1) OR `cases`.`user_id` = 1)
AND (`cases`.`archived` != 1)
AND `cases`.`id` IN (1)  
ORDER BY `cases`.`id` DESC


SELECT `scorers`.`id` AS t0_r0, `scorers`.`code` AS t0_r1, `scorers`.`name` AS t0_r2, `scorers`.`owner_id` AS t0_r3, `scorers`.`scale` AS t0_r4, `scorers`.`query_test` AS t0_r5, `scorers`.`query_id` AS t0_r6, `scorers`.`manual_max_score` AS t0_r7, `scorers`.`manual_max_score_value` AS t0_r8, `scorers`.`show_scale_labels` AS t0_r9, `scorers`.`scale_with_labels` AS t0_r10, `scorers`.`created_at` AS t0_r11, `scorers`.`updated_at` AS t0_r12, `scorers`.`communal` AS t0_r13, `teams`.`id` AS t1_r0, `teams`.`name` AS t1_r1, `teams`.`owner_id` AS t1_r2, `teams`.`created_at` AS t1_r3, `teams`.`updated_at` AS t1_r4, `users`.`id` AS t2_r0, `users`.`email` AS t2_r1, `users`.`password` AS t2_r2, `users`.`agreed_time` AS t2_r3, `users`.`agreed` AS t2_r4, `users`.`first_login` AS t2_r5, `users`.`num_logins` AS t2_r6, `users`.`name` AS t2_r7, `users`.`administrator` AS t2_r8, `users`.`reset_password_token` AS t2_r9, `users`.`reset_password_sent_at` AS t2_r10, `users`.`company` AS t2_r11, `users`.`locked` AS t2_r12, `users`.`locked_at` AS t2_r13, `users`.`created_at` AS t2_r14, `users`.`updated_at` AS t2_r15, `users`.`default_scorer_id` AS t2_r16, `users`.`email_marketing` AS t2_r17
FROM `scorers`
LEFT OUTER JOIN `teams_scorers` ON `teams_scorers`.`scorer_id` = `scorers`.`id`
LEFT OUTER JOIN `teams` ON `teams`.`id` = `teams_scorers`.`team_id`
LEFT OUTER JOIN `teams_members` ON `teams_members`.`team_id` = `teams`.`id`
LEFT OUTER JOIN `users` ON `users`.`id` = `teams_members`.`member_id`
WHERE ((`teams`.`owner_id` = 1 OR `teams_members`.`member_id` = 1) OR `scorers`.`owner_id` = 1)
