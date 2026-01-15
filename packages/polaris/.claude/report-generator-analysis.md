# Report Generator Agent Analysis

## Overview

The Report Generator agent was designed to generate publication-ready methods sections from Galaxy history analyses. This document captures the limitations encountered and features that would improve the agent.

## Current Implementation

```
Flow: fetch_histories → select_history → fetch_contents → fetch_jobs →
      fetch_citations → analyze_workflow → generate_methods → done
```

**7 nodes total**: 1 planner, 4 executors, 2 reasoning, 1 terminal

## Limitations Encountered

### 1. No Loop/Iteration Support (Critical)

**Problem**: The agent fetches a list of jobs but cannot iterate through them to get detailed parameters for each job.

**Current workaround**: Rely on the `jobs.get` endpoint to return enough information in a single call. The reasoning node has to work with summary data rather than detailed per-job parameters.

**Impact**: The generated methods section may lack specific parameter details that would be in individual `jobs.show.parameters_display.get` calls.

**Desired capability**:
```yaml
fetch_job_details:
  type: loop
  over:
    $ref: state.jobs
  as: job
  execute:
    type: executor
    run:
      op: api.call
      target: galaxy.jobs.show.parameters_display.get
      input:
        job_id:
          $ref: job.id
  emit:
    state.job_details:
      $append: result
```

### 2. No Parallel Execution

**Problem**: The 4 executor nodes run sequentially even though some could run in parallel:
- `fetch_contents` and `fetch_jobs` could run simultaneously after `select_history`
- `fetch_citations` could run in parallel with job fetching

**Impact**: Slower execution, especially with high API latency.

**Desired capability**:
```yaml
fetch_all_data:
  type: parallel
  branches:
    - fetch_contents
    - fetch_jobs
    - fetch_citations
  next: analyze_workflow
```

### 3. No Conditional Branches

**Problem**: Cannot conditionally fetch different data based on analysis type. For example:
- RNA-seq analysis might need different detail endpoints than variant calling
- Some histories might have workflow invocation data, others just jobs

**Current workaround**: Always fetch all possible data, let reasoning node ignore irrelevant parts.

**Desired capability**:
```yaml
check_workflow:
  type: control
  condition:
    $expr:
      op: exists
      path: state.contents
      where:
        type: workflow_invocation
  branches:
    true: fetch_workflow_details
    false: skip_to_jobs
```

### 4. No Error Recovery/Retry

**Problem**: If `fetch_citations` fails (some histories might not have citations), the entire agent fails.

**Impact**: Fragile agent that can't gracefully handle missing data.

**Desired capability**:
```yaml
fetch_citations:
  type: executor
  run: ...
  on_error:
    emit:
      state.citations: []
    next: analyze_workflow  # Continue anyway
```

### 5. No Data Aggregation Expressions

**Problem**: Cannot easily aggregate or transform fetched job data before passing to reasoning.

**Current workaround**: Pass raw arrays to reasoning and let LLM figure it out.

**Desired capability**:
```yaml
prepare_data:
  type: compute
  emit:
    state.tool_summary:
      $expr:
        op: group_by
        from:
          $ref: state.jobs
        key: tool_id
        aggregate:
          count: len
          tool_name: first.tool_id
```

### 6. Limited Output Formatting

**Problem**: Cannot format the final output in different styles (Markdown, LaTeX, plain text) without a separate reasoning call.

**Desired capability**: Built-in format templates or post-processing options.

## API Endpoints Used

| Endpoint | Purpose | Limitation |
|----------|---------|------------|
| `histories.get` | List available histories | None |
| `histories.show.contents.get` | Get datasets in history | None |
| `jobs.get` | List jobs (with history filter) | Only summary info |
| `histories.show.citations.get` | Get tool citations | May fail if no citations |

## API Endpoints We Wish We Could Use (Need Loops)

| Endpoint | Purpose |
|----------|---------|
| `jobs.show.get` | Full job details per job |
| `jobs.show.parameters_display.get` | Human-readable parameters |
| `jobs.show.inputs.get` | Input datasets per job |
| `jobs.show.outputs.get` | Output datasets per job |
| `tools.show.get` | Tool version and description |

## Recommended Polaris Enhancements

### Priority 1: Loop Support
Essential for any agent that needs to process collections of items individually.

### Priority 2: Error Handling
Allow agents to continue gracefully when optional data sources fail.

### Priority 3: Parallel Execution
Significant performance improvement for multi-fetch agents.

### Priority 4: Conditional Branching
Enable smarter, more adaptive agent flows.

## Conclusion

The Report Generator agent is functional but limited by Polaris's current sequential, non-iterative execution model. The most impactful enhancement would be loop support, followed by error handling. With these two features, the agent could:

1. Fetch detailed parameters for every job (loop)
2. Handle missing citations gracefully (error handling)
3. Produce much more detailed and accurate methods sections

The current implementation works but relies heavily on the LLM's ability to work with incomplete summary data rather than precise per-job details.
