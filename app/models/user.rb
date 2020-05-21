# frozen_string_literal: true

# == Schema Information
#
# Table name: users
#
#  id                     :integer          not null, primary key
#  email                  :string(80)
#  password               :string(120)
#  agreed_time            :datetime
#  agreed                 :boolean
#  first_login            :boolean
#  num_logins             :integer
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
#  email_marketing        :boolean          not null
#

class User < ActiveRecord::Base
  # Associations

  # should be called default_scorer?
  #belongs_to :scorer, foreign_key: 'default_scorer_id', inverse_of: :owner
  belongs_to :default_scorer, class_name:  'Scorer'

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

  # Validations
  validates :email,
            presence:   true,
            uniqueness: true

  validates :password,
            presence: true

  validates_with ::DefaultScorerExistsValidator

  # Modules
  # Include default devise modules. Others available are:
  # :confirmable, :lockable, :timeoutable and :omniauthable
  # devise :database_authenticatable, :registerable,
  # :recoverable, :rememberable, :trackable, :validatable
  devise :recoverable, reset_password_keys: [ :email ]

  # Callbacks
  before_create :set_defaults
  before_save   :encrypt_password
  after_create  :add_default_case

  # Devise hacks since we only use the recoverable module
  attr_accessor :password_confirmation
  validates :password, confirmation: true

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
    # rubocop:disable Style/RedundantSelf
    puts "Setting defaults"
    puts "Setting user default scorer to #{Rails.application.config.quepid_default_scorer}" if self.default_scorer.nil?

    self.first_login      = true  if first_login.nil?
    self.num_logins       = 0     if num_logins.nil?
    self.default_scorer   = Scorer.find_by(name: Rails.application.config.quepid_default_scorer) if self.default_scorer.nil?
    # rubocop:enable Style/RedundantSelf

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
