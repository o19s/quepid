# frozen_string_literal: true

# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  username               :string(80)
#  password               :string(120)
#  agreed_time            :datetime
#  agreed                 :boolean
#  firstLogin             :boolean
#  numLogins              :integer
#  scorer_id              :integer
#  name                   :string(255)
#  administrator          :boolean          default(FALSE)
#  reset_password_token   :string(255)
#  reset_password_sent_at :datetime
#  company                :string(255)
#  locked                 :boolean
#  locked_at              :datetime
#  created_at             :datetime         not null
#  updated_at             :datetime         not null
#  default_scorer_id      :integer
#

class User < ActiveRecord::Base
  # Associations
  belongs_to :scorer
  has_many :cases,
           dependent:   :destroy

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

  has_many :owned_teams,
           class_name:  'Team',
           foreign_key: :owner_id,
           inverse_of:  :owner,
           dependent:   :destroy

  has_many :owned_team_cases,
           through: :owned_teams,
           source:  :cases

  has_many :shared_team_cases,
           through: :teams,
           source:  :cases

  has_many :shared_scorers,
           through: :teams,
           source:  :scorers

  has_many :permissions,
           dependent: :destroy

  belongs_to :default_scorer

  # Validations
  validates :username,
            presence:   true,
            uniqueness: true

  validates :password,
            presence: true

  validates_with ::ScorerExistsValidator

  # Modules
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable and :omniauthable
  # devise :database_authenticatable, :registerable,
  # :recoverable, :rememberable, :trackable, :validatable
  devise :recoverable, reset_password_keys: [ :username ]

  # Callbacks
  before_create :set_defaults
  before_save   :encrypt_password
  after_create  :add_default_case

  # Devise hacks since we only use the recoverable module
  attr_accessor :password_confirmation
  validates :password, confirmation: true

  alias_attribute :email, :username

  def encrypted_password_changed?
    password_changed?
  end
  # END devise hacks

  # Concerns
  include Permissible
  include Profile

  # Scopes
  default_scope -> { includes(:permissions) }

  # returns and owned or shared case for this user
  def find_case case_id
    cases.find_by(id: case_id) ||
      owned_team_cases.find_by(id: case_id) ||
      shared_team_cases.find_by(id: case_id)
  end

  def num_queries
    queries.count
  end

  def scorers
    UserScorerFinder.new(self)
  end

  def case
    UserCaseFinder.new(self)
  end

  def teams_im_in
    UserTeamFinder.new(self).call
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

  private

  def set_defaults
    self.firstLogin       = true  if firstLogin.nil?
    self.numLogins        = 0     if numLogins.nil?

    true # this is necessary because it will rollback
    # the creation/update of the user otherwise
  end

  def encrypt_password
    self[:password] = BCrypt::Password.create(password) if password.present? && password_changed?

    true
  end

  def add_default_case
    cases.create case_name: Case::DEFAULT_NAME
  end
end
