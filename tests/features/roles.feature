@roles
Feature: What a read-only member of the board, or someone it does not have, may not do
  A read-only member reads the board's cards and their comments, and neither changes a card, nor comments on it, nor
  adds one; an account the board does not have is told it is not found.

  Scenario: A read-only member reads a card, and neither changes nor comments on it
    Given I am a logged in user with the "reader" user
    When I open the board "Webship site"
    Then I should not be able to add a card to the list "To Do"
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should show the comment "Seen on the test site" by "Owner Test"
    And the card should be in the list "Doing"
    And I should not be able to change the card
    And I should not be able to comment on the card

  @js-off
  Scenario: An account the board does not have is refused it, and signs out
    Given I am a logged in user with the "stranger" user
    Then I should be refused the board "Webship site"
    When I log out
    Then I should not be logged in
