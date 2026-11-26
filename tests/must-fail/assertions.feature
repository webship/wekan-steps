@must-fail
Feature: Assertions that must fail
  Each scenario asserts something that is not true on the test site: its last step must fail with the message its
  description announces, and a hint. The scenarios only read; tests/check-must-fail.js runs them.

  Scenario: A session that is not the account named
    Fails with: Expected to be logged in as "Owner Test", but the session is Member Test (member).
    Given I am a logged in user with the "member" user
    Then I should be logged in as "Owner Test"

  Scenario: A session that is there
    Fails with: Expected no session, but the session is Member Test's.
    Given I am a logged in user with the "member" user
    Then I should not be logged in

  Scenario: A sign-in that worked is not refused
    Fails with: Expected to see the sign-in form, but it did not appear within
    Given I am not logged in
    When I log in with the "member" user
    Then the login should be refused with "Incorrect password"

  Scenario: A card the list does not show
    Fails with: Expected to see the card "The greeting script says Helo instead of Hello" in the list "To Do", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the board "Webship site"
    Then the list "To Do" should show the card "The greeting script says Helo instead of Hello"

  Scenario: A card the list shows
    Fails with: Expected not to see the card "The greeting script says Helo instead of Hello" in the list "Doing", but it is still on the page.
    Given I am a logged in user with the "member" user
    When I open the board "Webship site"
    Then the list "Doing" should not show the card "The greeting script says Helo instead of Hello"

  Scenario: A board the account may open is not refused
    Fails with: Expected to see the site's "Board not found", but it did not appear within
    Given I am a logged in user with the "reader" user
    Then I should be refused the board "Webship site"

  Scenario: A member may add a card
    Fails with: Expected not to see "Add Card" in the list "To Do", but it is still on the page.
    Given I am a logged in user with the "member" user
    When I open the board "Webship site"
    Then I should not be able to add a card to the list "To Do"

  Scenario: A member may change a card
    Fails with: Expected not to see a control that changes the card (its list picker, its Labels or Assignee popup, its Spent time menu), but it is still on the page.
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then I should not be able to change the card

  Scenario: A member may comment on a card
    Fails with: Expected not to see the card's comment box, but it is still on the page.
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then I should not be able to comment on the card

  Scenario: A list the card is not in
    Fails with: Expected the card to be in the list "Done", but its panel says "Doing".
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should be in the list "Done"

  Scenario: A comment nobody wrote
    Fails with: Expected to see the comment "Nobody wrote this", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should show the comment "Nobody wrote this"

  Scenario: A comment by someone else
    Fails with: Expected to see the comment "Seen on the test site" by Member Test, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should show the comment "Seen on the test site" by "Member Test"

  Scenario: A label the card does not have
    Fails with: Expected to see the label "bug" on the card, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the card "The usage line spells greeting as greting"
    Then the card should have the label "bug"

  Scenario: A label the card has
    Fails with: Expected not to see the label "bug" on the card, but it is still on the page.
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should not have the label "bug"

  Scenario: An assignee the card does not have
    Fails with: Expected the card to be assigned to "Owner Test", but its assignees are Member Test.
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should be assigned to "Owner Test"

  Scenario: A maker who did not make the card
    Fails with: Expected the card to be created by "Member Test", but its Creator is "Owner Test".
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should be created by "Member Test"

  Scenario: A checklist item the card does not have
    Fails with: Expected to see the checklist item "Nothing like this", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should have the checklist item "Nothing like this"

  Scenario: Time nobody logged
    Fails with: Expected to see 2 h logged by Member Test, but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the card "The greeting script says Helo instead of Hello"
    Then the card should show the time "2 h" logged by "Member Test"

  Scenario: A sprint that is not active
    Fails with: Expected the sprint "Sprint 2" to be active, but the sprints are Sprint 1 (Active).
    Given I am a logged in user with the "member" user
    When I open the sprints of the board "Webship site"
    Then the sprint "Sprint 2" should be active

  Scenario: A card the sprint does not have
    Fails with: Expected to see the card "Add a test for the greeting" in the sprint "Sprint 1", but it did not appear within
    Given I am a logged in user with the "member" user
    When I open the sprints of the board "Webship site"
    Then the sprint "Sprint 1" should have the card "Add a test for the greeting"

  Scenario: A card the board does not have
    Fails with: No card "No such card here" on Webship site.
    Given I am a logged in user with the "member" user
    When I open the card "No such card here"

  Scenario: A board the managing account is not on
    Fails with: No board "No board like this" the managing account is on.
    Given I am a logged in user with the "member" user
    When I open the board "No board like this"
