default: test

test: test-js test-py

test-js:
    npm test

test-py:
    uv run python -m unittest discover -s tests/py -t .
