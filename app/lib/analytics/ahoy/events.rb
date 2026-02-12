# frozen_string_literal: true

#
# Module that wraps the GA events API to create Quepid specific
# events related to Quepid actions.
#
# rubocop:disable Metrics/ModuleLength
module Analytics
  module Ahoy
    module Events
      #
      # Creates an event when a user signs up.
      #
      # @param user, User
      #
      def user_signed_up user
        data = {
          category: 'Users',
          action:   'Signed Up',
          label:    user.email,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when an admin upgrades a user.
      #
      # @param user, User
      #
      def user_upgraded_by_admin user
        data = {
          category: 'Users',
          action:   'Upgraded by Admin',
          label:    user.email,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when user updates his profile.
      #
      # @param user, User
      #
      def user_updated_profile user
        data = {
          category: 'Users',
          action:   'Updated Profile',
          label:    user.email,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when an admin updates a user.
      #
      # @param user, User
      #
      def user_updated_by_admin user
        data = {
          category: 'Users',
          action:   'Updated by Admin',
          label:    user.email,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when user updates his password.
      #
      # @param user, User
      #
      def user_updated_password user
        data = {
          category: 'Users',
          action:   'Updated Password',
          label:    user.email,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when an admin resets a user's password.
      #
      # @param user, User
      #
      def user_reset_password_by_admin user
        data = {
          category: 'Users',
          action:   'Reset Password by Admin',
          label:    user.email,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user creates his first case.
      #
      # @param user,      User
      # @param the_case,  Case
      #
      def user_created_first_case user, _the_case
        data = {
          category: 'Cases',
          action:   'Created First Case',
          label:    user.email,
          value:    1,
        }

        create_event data
      end

      #
      # Creates an event when a user creates a new case.
      #
      # @param user,      User
      # @param the_case,  Case
      #
      def user_created_case user, the_case
        data = {
          category: 'Cases',
          action:   'Created a Case',
          label:    the_case.case_name,
          value:    user.cases.count,
        }

        create_event data
      end

      #
      # Creates an event when a user updates a case.
      #
      # @param user,      User
      # @param the_case,  Case
      #
      def user_updated_case _user, the_case
        data = {
          category: 'Cases',
          action:   'Updated a Case',
          label:    the_case.case_name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user archives a case.
      #
      # @param user,      User
      # @param the_case,  Case
      #
      def user_archived_case _user, the_case
        data = {
          category: 'Cases',
          action:   'Archived a Case',
          label:    the_case.case_name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user deletes a case.
      #
      # @param user,      User
      # @param the_case,  Case
      #
      def user_deleted_case _user, the_case
        data = {
          category: 'Cases',
          action:   'Deleted a Case',
          label:    the_case.case_name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user saves a new try for a case.
      #
      # @param user,    User
      # @param the_try, Try
      #
      def user_saved_case_try _user, the_try
        the_case = the_try.case

        data = {
          category: 'Case Tries',
          action:   'Saved a Case Try',
          label:    the_case.case_name,
          value:    the_try.try_number,
        }

        create_event data
      end

      #
      # Creates an event when a user shares a case
      # with an team.
      #
      # @param user,      User
      # @param the_case,  Case
      # @param team,      Team
      #
      def user_shared_case _user, the_case, _team
        data = {
          category: 'Cases',
          action:   'Shared a Case',
          label:    the_case.case_name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user swaps the protocol
      # used to access a case
      #
      # @param user,      User
      # @param the_case,  Case
      # @param protocol,  String
      #
      def user_swapped_protocol _user, the_case, protocol
        data = {
          category: 'Cases',
          action:   'Swapped to Protocol',
          label:    the_case.case_name,
          case_id:  the_case.id,
          value:    protocol,
        }

        create_event data
      end

      #
      # Creates an event when a user creates an team.
      #
      # @param user,    User
      # @param team,    Team
      #
      def user_created_team _user, team
        data = {
          category: 'Teams',
          action:   'Created an Team',
          label:    team.name,
          value:    1,
        }

        create_event data
      end

      #
      # Creates an event when a user updates an team.
      #
      # @param user,    User
      # @param team,    Team
      #
      def user_updated_team _user, team
        data = {
          category: 'Teams',
          action:   'Updated an Team',
          label:    team.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user deletes an team.
      #
      # @param user,    User
      # @param team,    Team
      #
      def user_deleted_team _user, team
        data = {
          category: 'Teams',
          action:   'Deleted an Team',
          label:    team.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user adds a member to an team.
      #
      # @param user,    User
      # @param team,    Team
      # @param member,  User
      #
      def user_added_member_to_team _user, team, _member
        data = {
          category: 'Teams',
          action:   'Added Member to an Team',
          label:    team.name,
          value:    team.members.count,
        }

        create_event data
      end

      #
      # Creates an event when a user removes a member from a team.
      #
      # @param user,    User
      # @param team,    Team
      # @param member,  User
      #
      def user_removed_member_from_team _user, team, _member
        data = {
          category: 'Teams',
          action:   'Removed Member from an Team',
          label:    team.name,
          value:    team.members.count,
        }

        create_event data
      end

      #
      # Creates an event when a user creates a custom scorer.
      #
      # @param user,    User
      # @param scorer,  Scorer
      #
      def user_created_scorer user, scorer
        data = {
          category: 'Scorers',
          action:   'Created a Scorer',
          label:    scorer.name,
          value:    user.owned_scorers.count,
        }

        create_event data
      end

      #
      # Creates an event when a user updates a custom scorer.
      #
      # @param user,    User
      # @param scorer,  Scorer
      #
      def user_updated_scorer _user, scorer
        data = {
          category: 'Scorers',
          action:   'Updated a Scorer',
          label:    scorer.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user deletes a custom scorer.
      #
      # @param user,    User
      # @param scorer,  Scorer
      #
      def user_deleted_scorer _user, scorer
        data = {
          category: 'Scorers',
          action:   'Deleted a Scorer',
          label:    scorer.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user shares a custom scorer
      # with an team.
      #
      # @param user,    User
      # @param scorer,  Scorer
      # @param team,    Team
      #
      def user_shared_scorer _user, scorer, _team
        data = {
          category: 'Scorers',
          action:   'Shared a Scorer',
          label:    scorer.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user creates a new snapshot.
      #
      # @param user,      User
      # @param snapshot,  Snapshot
      #
      def user_created_snapshot _user, snapshot
        the_case = snapshot.case

        data = {
          category: 'Snapshots',
          action:   'Created a Snapshot',
          label:    snapshot.name,
          value:    the_case.snapshots.count,
        }

        create_event data
      end

      #
      # Creates an event when a user deletes a snapshot.
      #
      # @param user,      User
      # @param snapshot,  Snapshot
      #
      def user_deleted_snapshot _user, snapshot
        data = {
          category: 'Snapshots',
          action:   'Deleted a Snapshot',
          label:    snapshot.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user creates a query.
      #
      # @param user,      User
      # @param query,     Query
      #
      def user_created_query _user, query
        the_case = query.case

        data = {
          category: 'Queries',
          action:   'Created a Query',
          label:    query.query_text,
          value:    the_case.queries.count,
        }

        create_event data
      end

      #
      # Creates an event when a user deletes a query.
      #
      # @param user,      User
      # @param query,     Query
      #
      def user_deleted_query _user, query
        data = {
          category: 'Queries',
          action:   'Deleted a Query',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user moves a query.
      #
      # @param user,      User
      # @param query,     Query
      # @param case,      Case
      #
      def user_moved_query _user, query, _old_case
        data = {
          category: 'Queries',
          action:   'Moved a Query',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user creates a rating.
      #
      # @param user,      User
      # @param rating,    Rating
      #
      def user_created_rating _user, rating
        query = rating.query

        data = {
          category: 'Ratings',
          action:   'Rated a Query',
          label:    query.query_text,
          value:    rating.rating,
        }

        create_event data
      end

      #
      # Creates an event when a user deletes a rating.
      #
      # @param user,      User
      # @param rating,    Rating
      #
      def user_deleted_rating _user, rating
        query = rating.query

        data = {
          category: 'Ratings',
          action:   'Reset a Query Rating',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user bulk updates ratings.
      #
      # @param user,      User
      # @param query,     Query
      #
      def user_bulk_updated_ratings _user, query
        data = {
          category: 'Ratings',
          action:   'Bulk Updated Query Ratings',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user bulk deletes ratings.
      #
      # @param user,      User
      # @param query,     Query
      #
      def user_bulk_deleted_ratings _user, query
        data = {
          category: 'Ratings',
          action:   'Bulk Deleted Query Ratings',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user updates query scorer.
      #
      # @param user,      User
      # @param query,     Query
      # @param scorer,    Scorer
      #
      def user_updated_query_scorer _user, query, _scorer
        data = {
          category: 'Queries',
          action:   'Updated Query Scorer',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user deletes query scorer.
      #
      # @param user,      User
      # @param query,     Query
      #
      def user_deleted_query_scorer _user, query
        data = {
          category: 'Queries',
          action:   'Deleted Query Scorer',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user updates query notes.
      #
      # @param user,      User
      # @param query,     Query
      #
      def user_updated_query_notes _user, query
        data = {
          category: 'Queries',
          action:   'Updated Query Notes',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user updates query options.
      #
      # @param user,      User
      # @param query,     Query
      #
      def user_updated_query_options _user, query
        data = {
          category: 'Queries',
          action:   'Updated Query Options',
          label:    query.query_text,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user creates a communal scorer.
      #
      # @param user,    User
      # @param scorer,  Scorer
      #
      def user_created_communal_scorer _user, scorer
        data = {
          category: 'CommunalScorers',
          action:   'Created a Communal Scorer',
          label:    scorer.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user updates a default scorer.
      #
      # @param user,    User
      # @param scorer,  DefaultScorer
      #
      def user_updated_communal_scorer _user, scorer
        data = {
          category: 'CommunalScorers',
          action:   'Updated a Communal Scorer',
          label:    scorer.name,
          value:    nil,
        }

        create_event data
      end

      #
      # Creates an event when a user populates an empty book of judgements with query doc pairs
      #
      # @param user,      User
      # @param the_case,  Case
      #
      def user_populated_book _user, book
        data = {
          category: 'Books',
          action:   'Populated empty book',
          label:    book.name,
          value:    book.id,
        }

        create_event data
      end

      #
      # Creates an event when a user refreshes a book with new query doc pairss.
      #
      # @param user,      User
      # @param the_case,  Case
      #
      def user_refreshed_book _user, book
        data = {
          category: 'Books',
          action:   'Refreshed a book',
          label:    book.name,
          value:    book.id,
        }

        create_event data
      end

      #
      # Creates an event in Ahoy
      #
      # @param data, Hash
      #
      # The data param includes the information for the event to register via Ahoy.
      # Inspired by the GA version. Hence the docs below.
      # It should have the following attributes:
      #
      # category: String
      # action:   String
      # label:    String
      # value:    Integer
      #
      def create_event data
        # return unless Analytics::Ahoy.enabled?

        name = "#{data[:category].parameterize(separator: '_')}:#{data[:action].parameterize(separator: '_')}"
        ahoy.track name, data
      end
    end
  end
end
# rubocop:enable Metrics/ModuleLength
