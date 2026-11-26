@board
Feature: A board and its lists
  A board opens on its lists, side by side: To Do, Doing and Done hold its open cards. An archived card is on none of
  them. A member adds a card to a list the way a person does.

  Scenario: The sample cards in their lists
    Given I am a logged in user with the "member" user
    When I open the board "Webship site"
    Then the list "Doing" should show the card "The greeting script says Helo instead of Hello"
    And the list "To Do" should show the card "The usage line spells greeting as greting"
    And the list "Done" should show the card "Add a test for the greeting"
    And the list "To Do" should not show the card "The greeting script says Helo instead of Hello"

  Scenario: A new card in a list
    Given there is no card "Webship test new" on the board "Webship site"
    And I am a logged in user with the "member" user
    When I open the board "Webship site"
    And I add the card "Webship test new" to the list "To Do"
    Then the list "To Do" should show the card "Webship test new"

  Scenario: An archived card leaves its board
    Given there is a card "Webship test archive" in the list "Doing" of the board "Webship site"
    And I am a logged in user with the "member" user
    When I open the card "Webship test archive"
    And I archive the card
    And I open the board "Webship site"
    Then the list "Doing" should not show the card "Webship test archive"
