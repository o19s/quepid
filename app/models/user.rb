# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "users"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "latin1"
# collation = "latin1_swedish_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "email", type = "string", nullable = true },
#   { name = "password", type = "string", nullable = true },
#   { name = "agreed_time", type = "datetime", nullable = true },
#   { name = "agreed", type = "boolean", nullable = true },
#   { name = "num_logins", type = "integer", nullable = true },
#   { name = "name", type = "string", nullable = true },
#   { name = "administrator", type = "boolean", nullable = true, default = "0" },
#   { name = "reset_password_token", type = "string", nullable = true },
#   { name = "reset_password_sent_at", type = "datetime", nullable = true },
#   { name = "company", type = "string", nullable = true },
#   { name = "locked", type = "boolean", nullable = true },
#   { name = "locked_at", type = "datetime", nullable = true },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false },
#   { name = "default_scorer_id", type = "integer", nullable = true },
#   { name = "email_marketing", type = "boolean", nullable = false, default = "0" },
#   { name = "invitation_token", type = "string", nullable = true },
#   { name = "invitation_created_at", type = "datetime", nullable = true },
#   { name = "invitation_sent_at", type = "datetime", nullable = true },
#   { name = "invitation_accepted_at", type = "datetime", nullable = true },
#   { name = "invitation_limit", type = "integer", nullable = true },
#   { name = "invited_by_id", type = "integer", nullable = true },
#   { name = "invitations_count", type = "integer", nullable = true, default = "0" },
#   { name = "completed_case_wizard", type = "boolean", nullable = false, default = "0" },
#   { name = "stored_raw_invitation_token", type = "string", nullable = true },
#   { name = "profile_pic", type = "string", nullable = true },
#   { name = "system_prompt", type = "string", nullable = true },
#   { name = "llm_key", type = "string", nullable = true },
#   { name = "options", type = "json", nullable = true }
# ]
#
# indexes = [
#   { name = "ix_user_username", columns = ["email"], unique = true },
#   { name = "index_users_on_invitation_token", columns = ["invitation_token"], unique = true },
#   { name = "index_users_on_reset_password_token", columns = ["reset_password_token"], unique = true },
#   { name = "index_users_on_default_scorer_id", columns = ["default_scorer_id"] },
#   { name = "index_users_on_invited_by_id", columns = ["invited_by_id"] },
#   { name = "index_users_on_name", columns = ["name"] }
# ]
#
# foreign_keys = [
#   { column = "default_scorer_id", references_table = "scorers", references_column = "id", name = "fk_rails_3c4ba42168" },
#   { column = "invited_by_id", references_table = "users", references_column = "id", name = "fk_rails_ae14a5013f" }
# ]
#
# == Notes
# - Association 'api_keys' should specify inverse_of
# - Association 'scores' should specify inverse_of
# - Association 'judgements' should specify inverse_of
# - Association 'case_metadata' should specify inverse_of
# - Association 'book_metadata' should specify inverse_of
# - Association 'api_keys' has N+1 query risk. Consider using includes/preload
# - Association 'cases' has N+1 query risk. Consider using includes/preload
# - Association 'books' has N+1 query risk. Consider using includes/preload
# - Association 'queries' has N+1 query risk. Consider using includes/preload
# - Association 'owned_scorers' has N+1 query risk. Consider using includes/preload
# - Association 'shared_team_cases' has N+1 query risk. Consider using includes/preload
# - Association 'shared_scorers' has N+1 query risk. Consider using includes/preload
# - Association 'scores' has N+1 query risk. Consider using includes/preload
# - Association 'judgements' has N+1 query risk. Consider using includes/preload
# - Association 'case_metadata' has N+1 query risk. Consider using includes/preload
# - Association 'book_metadata' has N+1 query risk. Consider using includes/preload
# - Association 'announcements' has N+1 query risk. Consider using includes/preload
# - Column 'email' should probably have NOT NULL constraint
# - Column 'password' should probably have NOT NULL constraint
# - Column 'agreed_time' should probably have NOT NULL constraint
# - Column 'agreed' should probably have NOT NULL constraint
# - Column 'num_logins' should probably have NOT NULL constraint
# - Column 'name' should probably have NOT NULL constraint
# - Column 'administrator' should probably have NOT NULL constraint
# - Column 'reset_password_token' should probably have NOT NULL constraint
# - Column 'company' should probably have NOT NULL constraint
# - Column 'locked' should probably have NOT NULL constraint
# - Column 'invitation_token' should probably have NOT NULL constraint
# - Column 'invitation_limit' should probably have NOT NULL constraint
# - Column 'invitations_count' should probably have NOT NULL constraint
# - Column 'stored_raw_invitation_token' should probably have NOT NULL constraint
# - Column 'profile_pic' should probably have NOT NULL constraint
# - Column 'system_prompt' should probably have NOT NULL constraint
# - Column 'llm_key' should probably have NOT NULL constraint
# - Column 'options' should probably have NOT NULL constraint
# - Boolean column 'agreed' should have a default value
# - Boolean column 'locked' should have a default value
# - Column 'email_marketing' is commonly used in queries - consider adding an index
# - Column 'stored_raw_invitation_token' is commonly used in queries - consider adding an index
# <rails-lens:schema:end>
# rubocop:disable Metrics/ClassLength

class User < ApplicationRecord
  # Encrypted attributes
  encrypts :llm_key, deterministic: false

  # Associations
  has_many :api_keys, dependent: :destroy

  belongs_to :default_scorer, class_name: 'Scorer', optional: true # for communal scorers there isn't a owner

  has_many :cases,
           class_name:  'Case',
           foreign_key: :owner_id,
           inverse_of:  :owner,
           dependent:   :nullify

  has_many :books,
           class_name:  'Book',
           foreign_key: :owner_id,
           inverse_of:  :owner,
           dependent:   :nullify

  has_many :queries, through: :cases

  has_many :owned_scorers,
           class_name:  'Scorer',
           foreign_key: :owner_id,
           inverse_of:  :owner,
           dependent:   :destroy

  # too late now!
  # rubocop:disable Rails/HasAndBelongsToMany
  has_and_belongs_to_many :teams,
                          join_table:  'teams_members',
                          foreign_key: 'member_id'
  # rubocop:enable Rails/HasAndBelongsToMany

  has_many :shared_team_cases,
           through: :teams,
           source:  :cases

  has_many :shared_scorers,
           through: :teams,
           source:  :scorers

  has_many :scores,
           dependent: :destroy

  has_many :judgements,
           dependent: :restrict_with_error

  has_many :case_metadata,
           class_name: 'CaseMetadatum',
           dependent:  :destroy
  has_many :book_metadata,
           class_name: 'BookMetadatum',
           dependent:  :destroy

  has_many :announcements, foreign_key: 'author_id', dependent: :destroy, inverse_of: :author

  # Validations
  validates :name,
            length: { maximum: 255 }

  validates :name,
            presence: true, if: :ai_judge?

  # https://davidcel.is/posts/stop-validating-email-addresses-with-regex/
  validates :email,
            presence:   true,
            uniqueness: true,
            format:     { with: URI::MailTo::EMAIL_REGEXP },
            length:     { maximum: 80 },
            unless:     :ai_judge?

  validates :password,
            presence: true,
            length:   { maximum: 80 },
            unless:   :ai_judge?

  validates :password, confirmation: { message: 'should match confirmation' }, unless: :ai_judge?

  validates :reset_password_token,
            length: { maximum: 255 }
  validates :invitation_token,
            length: { maximum: 255 }
  validates :stored_raw_invitation_token,
            length: { maximum: 255 }

  validates :company,
            length: { maximum: 255 }
  validates :profile_pic,
            length: { maximum: 4000 }

  validates_with ::DefaultScorerExistsValidator

  validates :agreed,
            acceptance: { message: 'checkbox must be clicked to signify you agree to the terms and conditions.' },
            if:         :terms_and_conditions?

  validates :llm_key, length: { maximum: 255 }, allow_nil: false, presence: true, if: :ai_judge?
  validates :system_prompt, length: { maximum: 4000 }, allow_nil: true, presence: true, if: :ai_judge?

  def terms_and_conditions?
    Rails.application.config.terms_and_conditions_url.present?
  end

  # Callbacks
  before_save :encrypt_password
  before_save :check_agreed_time
  before_create :set_defaults
  before_destroy :check_scorer_ownership_before_removing!, prepend: true
  before_destroy :check_judgements_before_removing!, prepend: true

  def check_judgements_before_removing!
    if judgements.any?
      errors.add(:base, "Please reassign ownership of the #{judgements.count} judgements." )
      throw(:abort)
    end
  end

  def check_scorer_ownership_before_removing!
    owned_scorers.each do |scorer|
      if shared_scorers.include?(scorer)
        errors.add(:base, "Please remove the scorer #{scorer.name} from the team before deleting this user." )
        throw(:abort)
      end
    end
  end

  # Modules
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable and :omniauthable
  # devise :invitable, :database_authenticatable, :registerable,
  # :recoverable, :rememberable, :trackable, :validatable
  devise :invitable, :recoverable, :omniauthable, omniauth_providers: [ :keycloakopenid, :google_oauth2 ]
  # devise :omniauthable, omniauth_providers: %i[keycloakopenid]
  # devise :invitable, :recoverable, :omniauthable

  # Devise hacks since we only use the recoverable module
  attr_accessor :password_confirmation

  validates :password, confirmation: true

  def encrypted_password_changed?
    password_changed?
  end

  # Because we want to be able to send the acceptance invite later,
  # store the raw invitation token in our own column for reuse later
  before_invitation_created :store_raw_invitation_token

  def store_raw_invitation_token
    self.stored_raw_invitation_token = raw_invitation_token
  end
  # END devise hacks

  # Concerns
  include Profile

  # Scopes
  # default_scope -> { includes(:permissions) }
  scope :only_ai_judges, -> { where('`users`.`llm_key` IS NOT NULL') }

  # Lets get STI in and have actual AiJudge and User objects!
  def ai_judge?
    !llm_key.nil?
  end

  def num_queries
    queries.count
  end

  # All the scorers that you have access to, either as communal or as owner or via a team.
  def scorers_involved_with
    Scorer.for_user(self)
  end

  # This method returns not just the cases the user is the owner of, which .cases
  # does, but also via being in a team, those team cases as well.
  def cases_involved_with
    Case.for_user(self)
  end

  # This method returns all the books that the user has access to via it's teams.
  def books_involved_with
    Book.for_user(self)
  end

  # This method returns all the search_endpoints that the user has access as owner or via a team.
  def search_endpoints_involved_with
    SearchEndpoint.for_user(self)
  end

  def locked?
    true == locked
  end

  def lock
    self.locked     = true
    self.locked_at  = Time.zone.now
  end

  def unlock
    self.locked     = false
    self.locked_at  = nil
  end

  def fullname
    if name.blank?
      email.presence || 'Anonymous'
    else
      name.titleize
    end
  end

  def after_database_authentication
    # required by devise_invitable
  end

  def pending_invite?
    created_by_invite? && !invitation_accepted? && password.blank?
  end

  def unseen_app_notifications
    Announcement
      .left_outer_joins(:announcement_viewed)
      .where('user_id != ? OR user_id IS NULL', id)
      .order(:created_at)
  end

  def judge_options
    # ugh, why isn't this :judge_options?
    opts = options&.dig('judge_options') || {}
    opts.deep_symbolize_keys
  end

  def judge_options= value
    # Initialize options as empty hash if nil
    self.options ||= {}

    # Set the judge_options within options
    self.options = options.merge(judge_options: value)
  end

  private

  def set_defaults
    # rubocop:disable Style/RedundantSelf
    self.completed_case_wizard = false if completed_case_wizard.nil?
    self.num_logins       = 0 if num_logins.nil?
    self.default_scorer   = Scorer.system_default_scorer if self.default_scorer.nil?
    # rubocop:enable Style/RedundantSelf
  end

  def encrypt_password
    self[:password] = BCrypt::Password.create(password) if password.present? && password_changed?
  end

  def check_agreed_time
    return unless terms_and_conditions?

    return unless agreed && agreed_time.nil?

    self[:agreed_time] = Time.zone.now
  end
end
# rubocop:enable Metrics/ClassLength
