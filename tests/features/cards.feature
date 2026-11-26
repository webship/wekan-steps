@cards
Feature: The cards of a board
  A member of the board opens a card, moves it to another list, comments on it, labels it and assigns it; a sample
  card shows its maker, its assignee, its label, its comment, its checklist and the time logged on it. Every card a
  scenario makes goes after it.

  Scenario: A sample card: its maker, its assignee, its label, its list, its comment, its checklist and its time
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should be created by "Owner Test"
    And the card should be assigned to "Member Test"
    And the card should have the label "bug"
    And the card should be in the list "Doing"
    And the card should show the comment "Seen on the test site" by "Owner Test"
    And the card should have the checklist item "Fix the spelling in greeting.sh"
    And the card should show the time "0.5 h" logged by "Member Test"

  Scenario: A sample card made by the member
    Given I am a logged in user with the "member" user
    When I open the card "The usage line spells greeting as greting"
    Then the card should be created by "Member Test"
    And the card should be in the list "To Do"
    And the card should not have the label "bug"

  Scenario: A card moved to another list, and back
    Given there is a card "Webship test move" in the list "To Do" of the board "Webship site"
    And I am a logged in user with the "member" user
    When I open the card "Webship test move"
    And I move the card to the list "Done"
    Then the card should be in the list "Done"
    When I move the card to the list "Doing"
    Then the card should be in the list "Doing"

  Scenario: A comment, a label and an assignee on a card
    Given there is a card "Webship test work" in the list "To Do" of the board "Webship site"
    And I am a logged in user with the "member" user
    When I open the card "Webship test work"
    And I add the comment "Checked on the test site" to the card
    Then the card should show the comment "Checked on the test site" by "Member Test"
    When I add the label "bug" to the card
    Then the card should have the label "bug"
    When I assign the card to "Owner Test"
    Then the card should be assigned to "Owner Test"
