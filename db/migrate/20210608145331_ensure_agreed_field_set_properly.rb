# If we have enabled terms and conditions, then we need the user.agreed boolean
# to be true/false, as well having the user.agreed_time set.  In looking at
# Production Quepid, we see that agreed_time is always set, but agreed isn't always.  So
# lets set that to true where the agreed_time is set.  This impacts 264 legacy user accounts.

class EnsureAgreedFieldSetProperly < ActiveRecord::Migration[5.2]
  def change

    if Rails.application.config.terms_and_conditions_url.present?
      EnsureAgreedFieldSetProperly.connection.execute(
        "
        UPDATE users set agreed = 1
        WHERE agreed_time IS NOT NULL AND agreed != 1
        "
      )
    end
  end
end
