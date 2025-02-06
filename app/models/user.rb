# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength

# == Schema Information
#
# Table name: users
#
#  id                          :integer          not null, primary key
#  administrator               :boolean          default(FALSE)
#  agreed                      :boolean
#  agreed_time                 :datetime
#  company                     :string(255)
#  completed_case_wizard       :boolean          default(FALSE), not null
#  email                       :string(80)
#  email_marketing             :boolean          default(FALSE), not null
#  invitation_accepted_at      :datetime
#  invitation_created_at       :datetime
#  invitation_limit            :integer
#  invitation_sent_at          :datetime
#  invitation_token            :string(255)
#  invitations_count           :integer          default(0)
#  locked                      :boolean
#  locked_at                   :datetime
#  name                        :string(255)
#  num_logins                  :integer
#  openai_key                  :string(255)
#  password                    :string(120)
#  profile_pic                 :string(4000)
#  reset_password_sent_at      :datetime
#  reset_password_token        :string(255)
#  stored_raw_invitation_token :string(255)
#  system_prompt               :string(4000)
#  created_at                  :datetime         not null
#  updated_at                  :datetime         not null
#  default_scorer_id           :integer
#  invited_by_id               :integer
#
# Indexes
#
#  index_users_on_default_scorer_id     (default_scorer_id)
#  index_users_on_invitation_token      (invitation_token) UNIQUE
#  index_users_on_invited_by_id         (invited_by_id)
#  index_users_on_name                  (name)
#  index_users_on_reset_password_token  (reset_password_token) UNIQUE
#  ix_user_username                     (email) UNIQUE
#
# Foreign Keys
#
#  fk_rails_...  (default_scorer_id => scorers.id)
#  fk_rails_...  (invited_by_id => users.id)
#

class User < ApplicationRecord
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

  #has_many :owned_teams,
  #         class_name:  'Team',
  #         foreign_key: :owner_id,
  #         inverse_of:  :owner,
  #         dependent:   :destroy

  #has_many :owned_team_cases,
  #         through: :owned_teams,
  #         source:  :cases

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

  # https://davidcel.is/posts/stop-validating-email-addresses-with-regex/
  validates :email,
            presence:   true,
            uniqueness: true,
            format:     { with: URI::MailTo::EMAIL_REGEXP },
            length:     { maximum: 80 },
            unless:     :ai_judge?

  validates :password,
            presence: true,
            length:   { maximum: 80 }

  validates :password, confirmation: { message: 'should match confirmation' }

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

  validates :openai_key, length: { maximum: 255 }, allow_nil: true, presence: true, if: :ai_judge?
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
    if judgements.count.positive?
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
  scope :only_ai_judges, -> { where('`users`.`openai_key` IS NOT NULL') }

  def ai_judge?
    !openai_key.nil?
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
