# Agent Ideas for Galaxy Polaris

## Current Agents

| Agent | Purpose |
|-------|---------|
| `history_explorer.yml` | Browse histories → select one → view contents → generate AI summary |

---

## Proposed New Agents

### 1. Troubleshooter Agent 🔧
**Purpose**: Diagnose failed jobs and suggest fixes

```
Flow: Get histories → Find failed jobs → Analyze error logs →
      Check input data → Suggest remediation
```

**Use case**: "Why did my HISAT2 job fail?"
- Fetches job details and stderr
- Checks if inputs are valid (format, size)
- Looks for common error patterns
- Suggests specific fixes (memory, parameters, input format)

**Required APIs**:
- `jobs.get` - List jobs with state filter
- `jobs.show` - Get job details including stderr
- `datasets.show` - Check input dataset details

---

### 2. Data Quality Agent 📊
**Purpose**: Assess quality of datasets in a history

```
Flow: Get history contents → Identify QC-able datasets →
      Fetch quality metrics → Generate quality report
```

**Use case**: "Are my FASTQ files good quality?"
- Finds datasets by type (fastq, bam, vcf)
- Retrieves associated QC reports (FastQC, etc.)
- Summarizes quality issues
- Recommends whether to proceed or re-sequence

**Required APIs**:
- `histories.contents` - List datasets
- `datasets.show` - Get dataset metadata
- Dataset content preview for QC metrics

---

### 3. Workflow Recommender Agent 🧬
**Purpose**: Suggest analysis workflows based on data

```
Flow: Analyze dataset types → Understand user goal →
      Search available workflows → Recommend best match
```

**Use case**: "I have RNA-seq data, what should I run?"
- Examines input data types
- Asks clarifying questions (organism, goal)
- Matches to available workflows
- Explains what each workflow does

**Required APIs**:
- `workflows.get` - List available workflows
- `workflows.show` - Get workflow details
- `datasets.show` - Analyze input data types

---

### 4. Provenance Explorer Agent 🔍
**Purpose**: Trace where data came from

```
Flow: Pick dataset → Trace lineage → Build provenance tree →
      Explain each step → Generate reproducibility report
```

**Use case**: "How was this VCF file created?"
- Walks backward through job history
- Documents each transformation
- Lists tools and parameters used
- Creates shareable provenance summary

**Required APIs**:
- `datasets.show` - Get creating job info
- `jobs.show` - Get job parameters and inputs
- Recursive traversal of job inputs

---

### 5. Storage Optimizer Agent 💾
**Purpose**: Find disk space to reclaim

```
Flow: Get all histories → Calculate sizes → Find duplicates →
      Identify deletable items → Suggest cleanup plan
```

**Use case**: "I'm running out of quota, what can I delete?"
- Scans histories for large datasets
- Finds intermediate files safe to delete
- Identifies duplicate uploads
- Prioritizes by size and importance

**Required APIs**:
- `histories.get` - List all histories with sizes
- `histories.contents` - Get dataset sizes
- `users.show` - Get quota usage

---

### 6. Comparison Agent ⚖️
**Purpose**: Compare two analyses or datasets

```
Flow: Select two items → Fetch details → Diff parameters →
      Compare outputs → Summarize differences
```

**Use case**: "Why did these two runs give different results?"
- Compares tool versions
- Diffs parameter settings
- Compares input data
- Explains likely cause of differences

**Required APIs**:
- `jobs.show` - Get job parameters
- `datasets.show` - Get dataset metadata
- `tools.show` - Get tool versions

---

### 7. Report Generator Agent 📝
**Purpose**: Create publication-ready analysis reports

```
Flow: Select history/workflow → Gather all outputs →
      Generate narrative → Format as report
```

**Use case**: "Generate a methods section for my paper"
- Collects all tools used
- Documents versions and parameters
- Writes methods in publication style
- Includes reproducibility information

**Required APIs**:
- `histories.contents` - Get all datasets
- `jobs.get` - Get all jobs in history
- `jobs.show` - Get detailed parameters
- `tools.show` - Get tool citations

---

### 8. Tool Finder Agent 🔨
**Purpose**: Find the right tool for a task

```
Flow: Understand user need → Search tool shed →
      Filter by compatibility → Explain options
```

**Use case**: "I need to convert BAM to FASTQ"
- Parses natural language request
- Searches available tools
- Checks input/output compatibility
- Recommends best option with reasoning

**Required APIs**:
- `tools.get` - Search/list tools
- `tools.show` - Get tool details and I/O specs

---

### 9. Batch Status Agent 📋
**Purpose**: Monitor multiple running jobs

```
Flow: Find running/queued jobs → Get status of each →
      Estimate completion → Alert on issues
```

**Use case**: "What's the status of my analysis batch?"
- Lists all active jobs
- Shows progress/queue position
- Estimates time remaining
- Flags any failures early

**Required APIs**:
- `jobs.get` - List jobs by state
- `jobs.show` - Get job progress

---

### 10. Data Annotator Agent 🏷️
**Purpose**: Add metadata and tags to datasets

```
Flow: Analyze dataset content → Suggest tags →
      Infer metadata → Apply annotations
```

**Use case**: "Help me organize this messy history"
- Examines dataset names and types
- Suggests meaningful tags
- Groups related datasets
- Renames with consistent convention

**Required APIs**:
- `histories.contents` - List datasets
- `datasets.show` - Get current metadata
- `tags` API - Manage tags (if available)

---

## Complexity vs Value Matrix

```
                        HIGH VALUE
                            │
    Troubleshooter ●        │        ● Workflow Recommender
                            │
    Data Quality ●          │        ● Report Generator
                            │
    ────────────────────────┼────────────────────────
                            │
    Provenance ●            │        ● Tool Finder
                            │
    Storage Optimizer ●     │        ● Comparison
                            │
                        LOW VALUE

    LOW COMPLEXITY ◄────────┴────────► HIGH COMPLEXITY
```

---

## Implementation Priority

### Phase 1: Quick Wins
1. **Troubleshooter** - High value, users constantly ask "why did this fail?"
2. **Data Quality** - Natural extension of current browsing agents

### Phase 2: Core Capabilities
3. **Provenance Explorer** - Unique capability, important for reproducibility
4. **Tool Finder** - Helps new users discover Galaxy's capabilities

### Phase 3: Advanced Features
5. **Workflow Recommender** - Requires good workflow catalog
6. **Report Generator** - High complexity but very valuable
7. **Comparison Agent** - Useful for debugging

### Phase 4: Utility Agents
8. **Storage Optimizer** - Nice to have
9. **Batch Status** - Useful for power users
10. **Data Annotator** - Requires write APIs

---

## Node Types Needed Per Agent

| Agent | executor | planner | reasoning | control | compute |
|-------|----------|---------|-----------|---------|---------|
| Troubleshooter | ✓ | ✓ | ✓ | ✓ | ✓ |
| Data Quality | ✓ | ✓ | ✓ | | ✓ |
| Workflow Recommender | ✓ | ✓ | ✓ | ✓ | |
| Provenance Explorer | ✓ | ✓ | ✓ | ✓ | |
| Storage Optimizer | ✓ | | ✓ | | ✓ |
| Comparison | ✓ | ✓ | ✓ | | ✓ |
| Report Generator | ✓ | | ✓ | | ✓ |
| Tool Finder | ✓ | ✓ | ✓ | | |
| Batch Status | ✓ | | ✓ | ✓ | ✓ |
| Data Annotator | ✓ | ✓ | ✓ | | |

---

## API Endpoints Required

### Currently Supported (via OpenAPI)
- `GET /api/histories` - List histories
- `GET /api/histories/{id}` - Show history
- `GET /api/histories/{id}/contents` - List history contents
- `GET /api/datasets/{id}` - Show dataset

### Needed for New Agents
- `GET /api/jobs` - List jobs (with state filter)
- `GET /api/jobs/{id}` - Show job details
- `GET /api/workflows` - List workflows
- `GET /api/workflows/{id}` - Show workflow
- `GET /api/tools` - Search/list tools
- `GET /api/tools/{id}` - Show tool details
- `GET /api/users/current` - Get quota info

### Optional (for write operations)
- `PUT /api/datasets/{id}` - Update metadata
- `POST /api/tags` - Add tags
- `DELETE /api/datasets/{id}` - Delete dataset
