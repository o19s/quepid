# frozen_string_literal: true

module AccountsHelper
  def account_type _user
    'user'
  end

  def account_label user
    tag(
      :span,
      account_type(user).titleize,
      class: "label #{account_type user}"
    )
  end
end
