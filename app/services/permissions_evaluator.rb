# frozen_string_literal: true

class PermissionsEvaluator
  def initialize user
    @user = user
  end

  # rubocop:disable Metrics/MethodLength
  def run
    grouped_permissions = Permissible.grouped_permissions
    permissions         = @user.permissions_hash
    evaled_permissions  = {}

    grouped_permissions.each do |model_name, actions|
      evaled_permissions[model_name] ||= {}

      model_class   = model_name.to_s.capitalize
      policy_class  = "#{model_name.to_s.capitalize}Policy"
      policy        = Pundit.policy(@user, model_class.constantize)

      actions.each do |action, _value|
        user_value = permissions[model_name][action] if permissions[model_name]

        if policy_class.constantize.try(:send, :method_defined?, "#{action}?".to_sym)
          policy_value = policy.try(:send, "#{action}?".to_sym)
        end

        # Not using the shorthand || because:
        # false || true == true
        # and in this case we want the first value to be deciding value
        # and not override it by the default values.
        final_value   = policy_value
        final_value   = user_value if final_value.nil?

        evaled_permissions[model_name][action] = final_value
      end
    end

    evaled_permissions
  end
  # rubocop:enable Metrics/MethodLength
end
