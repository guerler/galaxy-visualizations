"""Tests for expression operators."""

import pytest

from polaris.modules.exceptions import ExpressionError
from polaris.modules.expressions import (
    EXPR_OPS,
    expr_any,
    expr_coalesce,
    expr_concat,
    expr_count_where,
    expr_eq,
    expr_get,
    expr_len,
    expr_lookup,
    expr_not,
)


class TestExprConcat:
    def test_concat_strings(self, resolve_identity):
        expr = {"args": ["hello", " ", "world"]}
        result = expr_concat(expr, {}, resolve_identity)
        assert result == "hello world"

    def test_concat_empty(self, resolve_identity):
        expr = {"args": []}
        result = expr_concat(expr, {}, resolve_identity)
        assert result == ""

    def test_concat_mixed_types(self, resolve_identity):
        expr = {"args": ["count: ", 42]}
        result = expr_concat(expr, {}, resolve_identity)
        assert result == "count: 42"


class TestExprCoalesce:
    def test_coalesce_returns_first_non_none(self, resolve_identity):
        expr = {"args": [None, None, "value", "other"]}
        result = expr_coalesce(expr, {}, resolve_identity)
        assert result == "value"

    def test_coalesce_all_none(self, resolve_identity):
        expr = {"args": [None, None]}
        result = expr_coalesce(expr, {}, resolve_identity)
        assert result is None

    def test_coalesce_first_value(self, resolve_identity):
        expr = {"args": ["first", None, "second"]}
        result = expr_coalesce(expr, {}, resolve_identity)
        assert result == "first"


class TestExprGet:
    def test_get_existing_key(self, resolve_identity):
        expr = {"obj": {"name": "test"}, "key": "name", "default": "fallback"}
        result = expr_get(expr, {}, resolve_identity)
        assert result == "test"

    def test_get_missing_key_returns_default(self, resolve_identity):
        expr = {"obj": {"name": "test"}, "key": "missing", "default": "fallback"}
        result = expr_get(expr, {}, resolve_identity)
        assert result == "fallback"

    def test_get_non_dict_returns_default(self, resolve_identity):
        expr = {"obj": "not a dict", "key": "name", "default": "fallback"}
        result = expr_get(expr, {}, resolve_identity)
        assert result == "fallback"


class TestExprLen:
    def test_len_list(self, resolve_identity):
        expr = {"arg": [1, 2, 3]}
        result = expr_len(expr, {}, resolve_identity)
        assert result == 3

    def test_len_string(self, resolve_identity):
        expr = {"arg": "hello"}
        result = expr_len(expr, {}, resolve_identity)
        assert result == 5

    def test_len_none(self, resolve_identity):
        expr = {"arg": None}
        result = expr_len(expr, {}, resolve_identity)
        assert result == 0

    def test_len_empty(self, resolve_identity):
        expr = {"arg": []}
        result = expr_len(expr, {}, resolve_identity)
        assert result == 0


class TestExprEq:
    def test_eq_true(self, resolve_identity):
        expr = {"left": "value", "right": "value"}
        result = expr_eq(expr, {}, resolve_identity)
        assert result is True

    def test_eq_false(self, resolve_identity):
        expr = {"left": "value", "right": "other"}
        result = expr_eq(expr, {}, resolve_identity)
        assert result is False

    def test_eq_numbers(self, resolve_identity):
        expr = {"left": 42, "right": 42}
        result = expr_eq(expr, {}, resolve_identity)
        assert result is True


class TestExprNot:
    def test_not_true(self, resolve_identity):
        expr = {"arg": True}
        result = expr_not(expr, {}, resolve_identity)
        assert result is False

    def test_not_false(self, resolve_identity):
        expr = {"arg": False}
        result = expr_not(expr, {}, resolve_identity)
        assert result is True

    def test_not_truthy(self, resolve_identity):
        expr = {"arg": "non-empty"}
        result = expr_not(expr, {}, resolve_identity)
        assert result is False

    def test_not_falsy(self, resolve_identity):
        expr = {"arg": ""}
        result = expr_not(expr, {}, resolve_identity)
        assert result is True


class TestExprLookup:
    def test_lookup_finds_match(self, resolve_identity):
        expr = {
            "from": [
                {"id": "a", "value": 1},
                {"id": "b", "value": 2},
            ],
            "match": {"field": "id", "equals": "b"},
            "select": "value",
        }
        result = expr_lookup(expr, {}, resolve_identity)
        assert result == 2

    def test_lookup_no_match_raises(self, resolve_identity):
        expr = {
            "from": [{"id": "a", "value": 1}],
            "match": {"field": "id", "equals": "z"},
            "select": "value",
        }
        with pytest.raises(ExpressionError, match="no match"):
            expr_lookup(expr, {}, resolve_identity)

    def test_lookup_missing_select_field_raises(self, resolve_identity):
        expr = {
            "from": [{"id": "a", "value": 1}],
            "match": {"field": "id", "equals": "a"},
            "select": "missing",
        }
        with pytest.raises(ExpressionError, match="select field not found"):
            expr_lookup(expr, {}, resolve_identity)

    def test_lookup_non_array_raises(self, resolve_identity):
        expr = {
            "from": "not an array",
            "match": {"field": "id", "equals": "a"},
            "select": "value",
        }
        with pytest.raises(ExpressionError, match="not an array"):
            expr_lookup(expr, {}, resolve_identity)


class TestExprCountWhere:
    def test_count_where_finds_matches(self, resolve_identity):
        expr = {
            "from": [
                {"status": "ok"},
                {"status": "error"},
                {"status": "ok"},
            ],
            "field": "status",
            "equals": "ok",
        }
        result = expr_count_where(expr, {}, resolve_identity)
        assert result == 2

    def test_count_where_no_matches(self, resolve_identity):
        expr = {
            "from": [{"status": "ok"}],
            "field": "status",
            "equals": "error",
        }
        result = expr_count_where(expr, {}, resolve_identity)
        assert result == 0

    def test_count_where_non_list(self, resolve_identity):
        expr = {
            "from": "not a list",
            "field": "status",
            "equals": "ok",
        }
        result = expr_count_where(expr, {}, resolve_identity)
        assert result == 0


class TestExprAny:
    def test_any_true(self, resolve_identity):
        expr = {
            "from": [
                {"status": "pending"},
                {"status": "done"},
            ],
            "field": "status",
            "equals": "done",
        }
        result = expr_any(expr, {}, resolve_identity)
        assert result is True

    def test_any_false(self, resolve_identity):
        expr = {
            "from": [
                {"status": "pending"},
                {"status": "pending"},
            ],
            "field": "status",
            "equals": "done",
        }
        result = expr_any(expr, {}, resolve_identity)
        assert result is False

    def test_any_non_list(self, resolve_identity):
        expr = {
            "from": "not a list",
            "field": "status",
            "equals": "ok",
        }
        result = expr_any(expr, {}, resolve_identity)
        assert result is False


class TestExprOpsRegistry:
    def test_all_ops_registered(self):
        expected_ops = ["any", "concat", "coalesce", "count_where", "get", "len", "eq", "not", "lookup"]
        for op in expected_ops:
            assert op in EXPR_OPS, f"Missing operator: {op}"

    def test_ops_are_callable(self):
        for name, fn in EXPR_OPS.items():
            assert callable(fn), f"Operator {name} is not callable"
