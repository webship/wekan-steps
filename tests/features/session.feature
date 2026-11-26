@session
Feature: Signing in and out
  An account signs in with its username and its password, and out again; a wrong password and an account the site
  does not have are refused, each with the site's own words.

  Scenario: An account signs in through the form and out again
    Given I am not logged in
    When I log in with the "member" user
    Then I should be logged in as "Member Test"
    When I log out
    Then I should not be logged in

  Scenario: A wrong password is refused
    When I log in as "member" with the password "not-the-right-password"
    Then the login should be refused with "Incorrect password"
    And I should not be logged in

  Scenario: An account the site does not have is refused
    When I log in as "nobody-on-this-site" with the password "not-the-right-password"
    Then the login should be refused with "User not found"
    And I should not be logged in

  Scenario: The session of an account, by its full name and its username
    Given I am a logged in user with the "owner" user
    Then I should be logged in as "Owner Test"
    And I should be logged in as "owner"
