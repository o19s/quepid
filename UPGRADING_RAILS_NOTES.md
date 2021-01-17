Todos:
* DONE Remove Spring, it doesn't help us in dockerized world.
* DONE Fix circle ci to run rails instead of rake for rails tests.  OR, do we just use Github Actions?
* DONE get bin/docker r bin/rake test:quepid to run `rails test`
* DONE fix FK links
* DONE (Not going to do it, just specify integer) resolve migration to bigint in mysql for id's
* DONE Test importing ratings, confirm the removal of `case.ratings`.
* DONE Test that when a snapshot has a query with docs, and a query wihtout docs, that the query without docs still gets snapshotted. Some weird JSON data. See `snapshots_controller_test.rb` __handles queries with no docs__ test...
* DONE (guessing casue maybe later you have docs?) Right now we support creating a snapshot with no docs.   WHY?   Look at `snapshots_controller_test.rb` __handles empty list of docs__.   
* DONE (added a replacement_scorer_id param which will let us clean up some stuff in production Quepid).   Interestingly we have on the /api/scorers (`scorers_controller.rb`) a *force* param that isn't used by the front end, that forces deleting a scorer.  i fixed the tests but left the code...  
* DONE We must figure out if a case MUST have a scorer or NOT!   We have all sorts of odd logic.  leaning towards if we have a future with N scorers, then it doens't have ot have one!  and that you don't get forced with a default.
* DONE (no issue!) When starting a new case, no Movie Search case name is set...
* DONE (Now we use try start with 1, and the wizard works!).  Okay, we pass around a try_id from the front end, however it's actually a try_number!  
* DONE (Changed my mind, I used it to reduce some extra sql joins etc) rip out extra dev analystics stuff
* DONE (no issue!) export of general and detail from js doesn't work.
* DONE Look at session in home_controller, do we use it???
* DONE, (password blank works fine).  Chase down why :password="" is needed when inviting a user.
* Deal with the format of the emails!  Make them quepid qlassy.
* DONE Deal with environment variable for disabling forms.


https://github.com/gonzalo-bulnes/simple_token_authentication
https://api.rubyonrails.org/classes/ActionController/HttpAuthentication/Token.html
https://github.com/lynndylanhurley/devise_token_auth

https://www.codementor.io/@gowiem/deviseinvitable-rails-api-9wzmbisus


User.invite!(email: 'joe@example.com', name: 'Joe', password:'password')

user = User.invite!(email: 'joe3@example.com', name: 'joe3', password:'password') do |u|
  u.skip_invitation = true
end

user = User.invite!({ email: 'joe8@example.com', name: 'Joe8', password:'password' }, current_user)
User.invite!({ email: 'new_user@example.com' }, current_user)


User.accept_invitation!(invitation_token: params[:invitation_token], password: 'ad97nwj3o2', name: 'John Doe')
User.accept_invitation!(invitation_token: '9ngHVdcWyvSNrg54a8yj', password: 'ad97nwj3o2', name: 'John Doe')


user = User.invite!({ email: 'joe9@example.com' }, current_user)


KEY!   http://railsdiff.org/4.2.11/5.2.4.4


https://dev.to/vvo/a-rails-6-setup-guide-for-2019-and-2020-hf5

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



Rubocop Notice:
```
The following cops were added to RuboCop, but are not configured. Please set Enabled to either `true` or `false` in your `.rubocop.yml` file.

Please also note that can also opt-in to new cops by default by adding this to your config:
  AllCops:
    NewCops: enable

Lint/DuplicateBranch: # (new in 1.3)
  Enabled: true
Lint/DuplicateRegexpCharacterClassElement: # (new in 1.1)
  Enabled: true
Lint/EmptyBlock: # (new in 1.1)
  Enabled: true
Lint/EmptyClass: # (new in 1.3)
  Enabled: true
Lint/NoReturnInBeginEndBlocks: # (new in 1.2)
  Enabled: true
Lint/ToEnumArguments: # (new in 1.1)
  Enabled: true
Lint/UnmodifiedReduceAccumulator: # (new in 1.1)
  Enabled: true
Style/ArgumentsForwarding: # (new in 1.1)
  Enabled: true
Style/CollectionCompact: # (new in 1.2)
  Enabled: true
Style/DocumentDynamicEvalDefinition: # (new in 1.1)
  Enabled: true
Style/NegatedIfElseCondition: # (new in 1.2)
  Enabled: true
Style/NilLambda: # (new in 1.3)
  Enabled: true
Style/RedundantArgument: # (new in 1.4)
  Enabled: true
Style/SwapValues: # (new in 1.1)
  Enabled: true
Rails/ActiveRecordCallbacksOrder: # (new in 2.7)
  Enabled: true
Rails/AfterCommitOverride: # (new in 2.8)
  Enabled: true
Rails/FindById: # (new in 2.7)
  Enabled: true
Rails/Inquiry: # (new in 2.7)
  Enabled: true
Rails/MailerName: # (new in 2.7)
  Enabled: true
Rails/MatchRoute: # (new in 2.7)
  Enabled: true
Rails/NegateInclude: # (new in 2.7)
  Enabled: true
Rails/Pluck: # (new in 2.7)
  Enabled: true
Rails/PluckInWhere: # (new in 2.7)
  Enabled: true
Rails/RenderInline: # (new in 2.7)
  Enabled: true
Rails/RenderPlainText: # (new in 2.7)
  Enabled: true
Rails/ShortI18n: # (new in 2.7)
  Enabled: true
Rails/SquishedSQLHeredocs: # (new in 2.8)
  Enabled: true
Rails/WhereExists: # (new in 2.7)
  Enabled: true
Rails/WhereNot: # (new in 2.8)
  Enabled: true
For more information: https://docs.rubocop.org/rubocop/versioning.html
```
