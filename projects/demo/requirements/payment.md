# Saved Card Payment

## Feature
Payment

## Priority
Critical

## Description
Customer should be able to complete checkout using a previously saved payment card.

## Preconditions
- Customer is logged in
- Customer has at least one saved card
- Product is available for checkout

## Acceptance Criteria
- Customer can select a saved card during checkout
- Successful payment API returns 201
- Order status becomes PAID
- Payment record is stored in database
- Declined payment displays an error message

## Test Steps
1. Login as an existing customer
2. Search for an available product
3. Add the product to cart
4. Open checkout
5. Select a saved card
6. Submit payment

## Expected Results
- Payment API returns 201
- Order status is PAID
- Payment record exists in database

## Tags
@critical @payment @ui @api @db
