Feature: Mood-Based Filtering
  As a user
  I want to filter movies by my current mood
  So that I see relevant suggestions for tonight

  Background:
    Given user id=1 is logged in and on /swipe
    And the MoodSelector component is rendered
    And available mood chips include:
      | Genres: Thriller, Comedy, Romance, Sci-Fi, Drama, Horror, Action, Documentary, Animation |
      | Vibes: Cozy, Intense, Feel-Good, Dark, Nostalgic, Mind-Bending                           |

  Scenario: User selects mood chips before swiping
    Given the MoodSelector is in expanded view
    When the user clicks the "Sci-Fi" chip in the "In the mood for" section
    Then the "Sci-Fi" chip gets class "bg-rose-600 text-white shadow-md shadow-rose-600/30"
    And the URL query string includes ?mood=Sci-Fi
    And subsequent GET /api/movies/next requests include the mood filter

  Scenario: User selects "not in the mood for" chips
    Given the MoodSelector is in expanded view
    When the user clicks the "Horror" chip in the "Not in the mood for" section
    Then the "Horror" chip gets class "bg-red-900/60 text-red-300 border-red-500/40 line-through"
    And the URL query string includes ?avoid=Horror
    And movies with Horror genre are excluded from results

  Scenario: Mood persists across movie fetches via URL params
    Given the URL contains ?mood=Comedy,Romance&avoid=Horror
    When the page loads or the user swipes to the next movie
    Then the MoodSelector reads mood and avoid from searchParams
    And the Comedy and Romance chips are shown as selected (bg-rose-600)
    And the Horror chip is shown as avoided (bg-red-900/60, line-through)
    And the mood state is preserved across movie card transitions

  Scenario: User uses free-text mood input
    Given the MoodSelector expanded view is visible
    When the user clicks "Or describe your mood..."
    Then a text input field appears with placeholder "e.g., something light with a twist ending"
    And an "Apply" button is shown next to the input
    When the user types "something light with a twist ending" and presses Enter
    Then the parseMoodAction server action is called with the free text
    And the LLM moodToFilters function parses the text into structured filters
    And the resulting preferredGenres and preferredVibes are added to the mood set
    And any avoidVibes are added to the avoid set
    And the URL is updated with the new mood and avoid params

  Scenario: LLM parses free-text mood into structured filters
    Given the user enters "I want something cozy from the 80s, nothing too intense"
    When parseMoodAction calls moodToFilters
    Then the LLM generates a MoodFilters object matching MoodFiltersSchema:
      | preferredGenres: ["Romance", "Comedy"]     |
      | preferredVibes: ["Cozy", "Nostalgic"]      |
      | avoidVibes: ["Intense", "Dark"]            |
      | yearGte: 1980                              |
      | yearLte: 1989                              |
      | maxRuntime: null                           |
    And the result is cached in llmCache with key "mood-to-filters:<hash>"
    And the TTL is 3600 seconds

  Scenario: User clicks "Surprise Me" to clear all filters
    Given the user has selected "Sci-Fi" in mood and "Horror" in avoid
    When the user clicks "Surprise Me!"
    Then both mood and avoid sets are cleared to empty
    And the URL query string has mood and avoid params removed
    And all chips return to their default unselected state

  Scenario: User skips mood selection entirely
    Given the MoodSelector expanded view is visible
    When the user clicks "Skip, show me everything"
    Then the hidden state is set to true
    And the URL query string includes ?mood-hidden=true
    And the MoodSelector collapses to a "Show mood filters" button
    And no mood or avoid filters are applied to movie requests

  Scenario: Both partners set complementary moods
    Given user id=1 selects mood "Sci-Fi" (URL: ?mood=Sci-Fi)
    And user id=2 selects mood "Drama" (URL: ?mood=Drama)
    When both users fetch movies
    Then each user's movie pool is filtered by their own mood selection
    And movies that match both Sci-Fi and Drama (e.g., "Arrival") rank higher for both users
    And the partnerLikelihood ranking factor accounts for the other user's taste profile

  Scenario: MoodSelector collapsed view shows active filters
    Given the user has selected "Thriller" in mood and "Comedy" in avoid
    When the user clicks "Collapse"
    Then the MoodSelector shows a single-line collapsed view
    And "Thriller" appears as a rose-600 pill badge
    And "Comedy" appears as a red-900/50 pill with line-through
    And an "Edit" button is shown to re-expand the selector
    When the user clicks "Edit"
    Then the MoodSelector returns to the expanded view

  Scenario: MoodSelector hidden state can be restored
    Given the MoodSelector is hidden (mood-hidden=true in URL)
    When the user clicks "Show mood filters"
    Then hidden is set to false
    And the full expanded MoodSelector is displayed
    And the URL no longer contains mood-hidden=true
