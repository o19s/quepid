

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
