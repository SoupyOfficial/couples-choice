Feature: Onboarding and Preference Setting
  As a new user
  I want to set my movie preferences
  So that I get personalized recommendations

  Background:
    Given the app has seeded users "Partner 1" (id=1) and "Partner 2" (id=2)
    And the LLM provider is configured with DEEPSEEK_API_KEY

  Scenario: First-time user describes their taste
    Given user id=1 has no preferenceNarrative set in the database
    When user id=1 logs in via the login page
    Then they are redirected to /onboarding
    And the page displays the heading "Tell Us Your Movie Tastes"
    And a textarea named "narrative" is visible with placeholder text
    And an "Analyze My Tastes →" submit button is visible

  Scenario: User with existing preferences is redirected
    Given user id=1 has extractedPrefs set in the database
    When user id=1 logs in via the login page
    Then they are redirected to /swipe
    And the /onboarding page is not shown

  Scenario: User submits empty preferences
    Given user id=1 is on the /onboarding page
    When the user submits the form with fewer than 10 characters in the narrative field
    Then they are redirected to /onboarding?error=too-short
    And no preferences are saved to the database

  Scenario: LLM extraction succeeds with clear narrative
    Given user id=1 is on the /onboarding page
    And the narrative textarea contains "We love mind-bending sci-fi like Inception and Interstellar, cozy 90s rom-coms, and Korean thrillers. No horror or depressing dramas."
    When the user clicks "Analyze My Tastes →"
    Then the LLM extractPreferences function is called with the narrative
    And the response matches ExtractedPrefsSchema with genres, yearRange, moods, avoidThemes, runtimePref, and languages
    And the user's extractedPrefs field is updated in the database
    And the user is redirected to /swipe

  Scenario: LLM extraction handles vague input gracefully
    Given user id=1 is on the /onboarding page
    And the narrative textarea contains "I like movies"
    When the user clicks "Analyze My Tastes →"
    Then the LLM extractPreferences function is called
    And if the LLM returns null (DEEPSEEK_API_KEY not set or model failure)
    Then the user is redirected to /onboarding?error=llm-failed
    And no preferences are saved

  Scenario: User skips onboarding
    Given user id=1 is on the /login page
    When user id=1 logs in but has no extractedPrefs
    Then they are redirected to /onboarding
    And there is no skip button on the onboarding page
    And the user must provide a narrative of at least 10 characters to proceed
