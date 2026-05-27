# PocketVibe Stage 1 — Manual Testing Checklist

Test on a real phone (or browser dev tools at 390×844).

---

## 1. Create each of the 10 tools

From the home screen, tap each category and use a starter prompt:

- [ ] **Finance** → Monthly budget
- [ ] **Goals & Habits** → Morning routine
- [ ] **Planning** → Plan a party
- [ ] **Food & Meals** → Weekly meal plan
- [ ] **Fitness** → Gym plan
- [ ] **Business** → Landing page
- [ ] **Checklists** → Moving house
- [ ] **Surprise** → Any starter

Also create:
- [ ] Savings goal (Finance → savings goal starter)
- [ ] Price list (Finance → price list starter)

Confirm: Each tool shows the correct layout, not raw JSON or an error.

---

## 2. Edit each tool

Tap the Edit button on each tool and make a change:

- [ ] Checklist — rename an item, check an item, add an item
- [ ] Habit tracker — rename a habit, change frequency
- [ ] Budget — change an amount, add an expense
- [ ] Savings goal — rename the goal, change target amount, delete a contribution
- [ ] Landing page — change business name, edit a feature
- [ ] Event planner — rename the event, check off a task
- [ ] Meal planner — change a meal name, add a grocery item
- [ ] Workout plan — rename the plan, edit an exercise
- [ ] Price calculator — change a price, add a line item
- [ ] Task planner — rename a task, mark done

Confirm: Changes stick after editing.

---

## 3. Save and reopen after refresh

- [ ] Make a creation, close the browser/app, reopen it
- [ ] Confirm the creation is still there with your edits

---

## 4. Ask "make this editable"

With a creation open, type "make this editable" in the input.

- [ ] App should explain how to use the built-in Edit button
- [ ] AI should NOT replace the creation

---

## 5. Ask "make this better"

With a creation open, type a real improvement request (e.g. "add more variety to the meals" on a meal planner).

- [ ] AI responds with an updated version
- [ ] The tool content visibly changes
- [ ] Your previous edits are reflected in the AI's input

---

## 6. Start a new tool while one is open

With a creation open, tap home or type a new prompt.

- [ ] App asks if you want to leave the current tool
- [ ] Confirm starts a new tool
- [ ] Cancel stays on the current tool

---

## 7. Copy text

With a creation open, tap **Copy text**.

- [ ] Text is copied to clipboard
- [ ] Pasting it shows plain, readable text (not JSON)
- [ ] No technical words like "schema", "render", "type:", etc.

---

## 8. Share tool (mobile only)

On a phone, with a creation open, tap **Share**.

- [ ] Native share sheet opens
- [ ] The shared text is readable

If Share is not available (desktop), confirm it falls back to copying.

---

## 9. Turn off AI — new creations still work

Remove the AI API key from `.env.local` (or disconnect network).

- [ ] Create a new tool from a starter
- [ ] App shows an offline fallback with the correct tool type (e.g. budget → shows a budget, not a generic checklist)
- [ ] Tool is fully editable

---

## 10. Turn off AI — improve/add never overwrites existing tools

With AI disconnected and a creation open:

- [ ] Type "make this better"
- [ ] The existing tool is NOT replaced
- [ ] App shows: "AI is not connected right now, but you can still edit this tool directly."
- [ ] The tool content is unchanged
- [ ] Version number has not changed

---

## Done

All 10 tests pass = Stage 1 is ready for wider testing.
