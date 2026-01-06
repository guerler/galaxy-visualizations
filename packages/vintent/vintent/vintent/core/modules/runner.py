from typing import Any, Dict, List, Optional

from vintent.core.completions import completions_post, get_tool_call
from .analysis import runAnalysis
from .csv.profiler import DatasetProfile, profile_csv
from .csv.values import values_from_csv
from .shells import shells
from .tools import build_choose_shell_tool, build_fill_shell_params_tool
from .schemas import TranscriptMessageType, TRANSCRIPT_VARIANT, CompletionsReply, CompletionsMessage


class Runner:
    def __init__(self, config):
        self.ai_base_url = config["ai_base_url"]
        self.ai_api_key = config["ai_api_key"]
        self.ai_model = config["ai_model"]

    async def run(
        self,
        file_name: str,
        transcripts: List[TranscriptMessageType],
    ) -> List[Any]:
        """Process transcripts and CSV data to generate visualizations."""
        wdgs: List[Any] = []

        with open(file_name) as f:
            csv_text = f.read()

        # Parse dataset
        profile: DatasetProfile = profile_csv(csv_text)
        values = values_from_csv(csv_text)

        # STEP 1: Choose shell
        choose_reply = await self._completions(transcripts, [build_choose_shell_tool(profile)])

        if choose_reply:
            choose_shell = get_tool_call(
                "choose_shell", choose_reply.get("choices", [{}])[0].get("message", {}).get("tool_calls")
            )

            if choose_shell and choose_shell.get("shellId"):
                shell_id = choose_shell["shellId"]
                shell = shells.get(shell_id)

                if shell:
                    # Log intent
                    transcripts.append(
                        {
                            "role": "assistant",
                            "content": f"I will produce a {shell.name}.",
                            "variant": TRANSCRIPT_VARIANT["INFO"],
                        }
                    )
                    transcripts.append(
                        {
                            "role": "assistant",
                            "content": f"Calling choose_shell_tool with: {shell_id}",
                            "variant": TRANSCRIPT_VARIANT["DATA"],
                        }
                    )

                    # STEP 2: Fill parameters
                    params: Dict[str, Any] = {}
                    param_reply = await self._completions(transcripts, [build_fill_shell_params_tool(shell, profile)])

                    if param_reply:
                        filled = get_tool_call(
                            "fill_shell_params",
                            param_reply.get("choices", [{}])[0].get("message", {}).get("tool_calls"),
                        )

                        if filled:
                            params.update(filled)

                        # STEP 3: Shell validation
                        validation = shell.validate(params, profile)

                        if validation["ok"]:
                            for warning in validation["warnings"]:
                                print(f"[orchestra] {warning.get('code')} {warning.get('details')}")

                            # STEP 4: Compile specification
                            effective_values = values
                            if shell.analysis:
                                effective_values = await runAnalysis(shell.analysis["id"], file_name)

                            # STEP 5: Compile via shell
                            spec = shell.compile(params, effective_values, "vega-lite")
                            wdgs.append(spec)
                            return wdgs
                        else:
                            print(f"[orchestra] {params} {validation}")
                            raise Exception("Invalid visualization parameters")
                    else:
                        raise Exception("No response when filling shell parameters")
                else:
                    raise Exception(f"Unknown shell selected: {shell_id}")
            else:
                raise Exception("LLM did not select a visualization shell")
        else:
            raise Exception("No response from AI provider")

    async def _completions(
        self, transcripts: List[TranscriptMessageType], tools: List[Dict[str, Any]]
    ) -> Optional[CompletionsReply]:
        """Make a completion request to the AI provider."""
        return await completions_post(
            {
                "ai_base_url": self.ai_base_url,
                "ai_api_key": self.ai_api_key,
                "ai_model": self.ai_model,
                "messages": _sanitize_transcripts(transcripts),
                "tools": tools,
            }
        )


def _sanitize_transcripts(transcripts: List[TranscriptMessageType]) -> List[CompletionsMessage]:
    """Filter and sanitize transcripts for AI consumption."""
    sanitized: List[CompletionsMessage] = []

    for t in transcripts:
        content = t.get("content")
        variant = t.get("variant")

        # Check if content is valid and variant is DATA (or no variant)
        if isinstance(content, str) and len(content) > 0 and (not variant or variant == TRANSCRIPT_VARIANT["DATA"]):
            sanitized.append({"role": t.get("role", ""), "content": content})

    return sanitized
