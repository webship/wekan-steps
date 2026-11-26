@sprints
Feature: The sprints of a board
  A board administrator turned Scrum planning on for the sample board: its Sprints show Sprint 1 active, with the
  first two cards in it. The board's view is each person's own: it is put back after the scenario.

  Scenario: The active sprint and its cards
    Given I am a logged in user with the "member" user
    When I open the sprints of the board "Webship site"
    Then the sprint "Sprint 1" should be active
    And the sprint "Sprint 1" should have the card "The greeting script says Helo instead of Hello"
    And the sprint "Sprint 1" should have the card "The usage line spells greeting as greting"
