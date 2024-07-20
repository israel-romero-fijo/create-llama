import os
from typing import List, Optional

from app.engine.index import get_index
from fastapi import HTTPException
from llama_index.core import QueryBundle
from llama_index.core.agent import AgentRunner
from llama_index.core.chat_engine import ContextChatEngine
from llama_index.core.postprocessor.types import BaseNodePostprocessor
from llama_index.core.schema import NodeWithScore


class NodeCitationProcessor(BaseNodePostprocessor):
    """
    Append citation information into node metadata
    """

    def _postprocess_nodes(
        self, nodes: List[NodeWithScore], query_bundle: Optional[QueryBundle]
    ) -> List[NodeWithScore]:
        """Postprocess nodes."""
        for node_score in nodes:
            node_score.node.metadata["citation_id"] = node_score.node.node_id
            node_score.node.metadata["citation_name"] = node_score.node.metadata[
                "file_name"
            ]
        return nodes


def get_chat_engine(filters=None):
    system_prompt = os.getenv("SYSTEM_PROMPT")
    top_k = int(os.getenv("TOP_K", 3))
    index = get_index()
    
    if index is None:
        raise HTTPException(
            status_code=500,
            detail=str(
                "StorageContext is empty - call 'poetry run generate' to generate the storage first"
            ),
        )
    retriever = index.as_retriever(
        similarity_top_k=top_k,
        filters=filters,
    )
    return ContextChatEngine.from_defaults(
        retriever=retriever,
        system_prompt=system_prompt,
        node_postprocessors=[NodeCitationProcessor()],
    )
