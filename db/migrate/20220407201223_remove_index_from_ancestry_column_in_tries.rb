class RemoveIndexFromAncestryColumnInTries < ActiveRecord::Migration[6.1]
  # we have discovered that we can't have a index on a string column longer then 767 bytes
  # unless we use special column formatting.   Which we have for go.quepidapp.com,
  # but not on our prod setup.
  # https://dev.mysql.com/doc/refman/8.0/en/innodb-limits.html#:~:text=The%20index%20key%20prefix%20length,REDUNDANT%20or%20COMPACT%20row%20format.
  # we don't need the index as there is only one page that shows this data...
  def up
    if index_exists?(:tries, :ancestry)
      remove_index :tries, :ancestry
    end
  end

  def down
    add_index :tries, :ancestry
  end
end
