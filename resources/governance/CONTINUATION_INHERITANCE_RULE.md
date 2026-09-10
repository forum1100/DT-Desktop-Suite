# Continuation Inheritance Rule

Status: ACTIVE USER-DIRECTED INTERPRETATION RULE

A short user continuation such as `continue`, `go ahead`, `ok`, `yes`, `do it`, or an equivalent acknowledgment must not be interpreted in isolation when reconstructing causal history.

The immediately preceding assistant turn is part of the causal instruction context when that turn proposed, described, queued, or offered a next action and the short user reply reasonably accepts that action.

Required preserved unit:

`assistant proposal/context -> user short acknowledgment -> subsequent execution/result`

The assistant turn must remain verbatim/source-faithful. The user acknowledgment must remain verbatim/source-faithful. Any statement that the acknowledgment authorized or continued a particular action is a derived relationship and must retain locators to both turns.

Never rewrite the short user message into a longer invented instruction. Never infer authorization beyond the action reasonably presented immediately before it.