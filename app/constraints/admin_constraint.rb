# frozen_string_literal: true

class AdminConstraint
  def self.matches? request
    return false unless request.session['current_user_id']

    user = User.find(request.session['current_user_id'])

    return false unless user

    return true if user.administrator?

    false
  end
end
