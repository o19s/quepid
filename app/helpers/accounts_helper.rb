# frozen_string_literal: true

module AccountsHelper
  def account_type _user
    puts 'I do not think I am used, but let me know!'
    'user'
  end

  def account_label user
    puts 'making a label maybe?'
    tag(
      :span,
      account_type(user).titleize,
      class: "label #{account_type user}"
    )
  end
end
