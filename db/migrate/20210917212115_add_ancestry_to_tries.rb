class AddAncestryToTries < ActiveRecord::Migration[6.1]
  def change
    add_column :tries, :ancestry, :string

    # Please see RemoveIndexFromAncestryColumnInTries migration which removes the add_index.
    # For folks upgrading from older versions of Quepid, since the add_index eventually gets remove_index,
    # lets just never add it.   See more info on https://github.com/rails/rails/issues/30305
    #add_index :tries, :ancestry
  end
end
