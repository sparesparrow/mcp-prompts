# Designing Cognitive Architectures: Agentic Workflow Patterns from Scratch
https://medium.com/google-cloud/designing-cognitive-architectures-agentic-workflow-patterns-from-scratch-63baa74c54bc

tldr: The rapid evolution of Large Language Models (LLMs) and Artificial Intelligence (AI) agents has sparked the development of sophisticated workflow patterns that enhance AI systems’ capabilities. This comprehensive technical guide explores advanced agentic workflow patterns, examining their technical intricacies, key features, variants, and interrelationships. From self-correcting mechanisms to dynamic task orchestration using Directed Acyclic Graphs (DAGs), we provide an in-depth analysis tailored for AI researchers and practitioners looking to harness these patterns in real-world applications.

This article serves as a compilation of 8 important agentic workflow patterns, exploring common, intuitive, and emerging techniques in AI workflows. The patterns discussed are agnostic of any particular foundational model, and while we use Gemini as a primary example, these patterns are easily transferable to other models. Additionally, all the patterns covered in this guide are accompanied by a GitHub repository for further exploration and implementation.

Agentic workflow patterns are powerful frameworks that guide the development of AI systems involving intelligent agents and LLMs. These patterns address niche functionality crucial to tackling diverse use cases — some operate independently, while others integrate human input at specific stages. For example, self-correction allows agents to refine outputs autonomously, and knowledge expansion provides real-time access to data beyond pre-trained information. Task coordination ensures seamless collaboration between specialized agents for complex tasks, and parallel processing enhances efficiency. Scalability adapts systems to handle large datasets, while dynamic adaptation enables workflows to adjust in real time based on context, ensuring sophisticated and flexible AI solutions designed to meet evolving challenges and requirements.
Recap of Previous Work

In our previous articles, we explored Architectural Patterns for Text-to-SQL and ReACT agents, including an in-depth examination of constructing a ReACT agent from the ground up. In our analysis of Natural Language to SQL (NL2SQL) architectural patterns, we emphasized the efficacy of self-correction mechanisms in validating LLM-generated SQL queries. This iterative process involved executing the query, identifying errors, and feeding this information back to the LLM, creating a robust feedback loop. This approach enhanced the prompt, informed the LLM of specific issues, and provided targeted guidance for query refinement, ultimately yielding significant improvements in query accuracy and reliability.

A parallel strategy proved equally effective within the ReACT framework covered in our previous article on this topic. In this context, we aggregated the thoughts, actions, and outputs from tool utilization (Wiki and Google Search), incorporating them into the agent’s working memory and feedback cycle. This approach allowed for more informed decision-making and adaptive behavior in complex, multi-step tasks.

While familiarity with these previous articles can provide valuable context, it is not a prerequisite for understanding the concepts presented in this discussion. The principles of feedback loops, self-correction, and iterative refinement in AI systems are broadly applicable and form the foundation for the advanced techniques we’ll explore further.

Now, let’s dive straight into exploring each of the agentic workflows we’ve put together, one by one. The entire repository containing all the patterns can be found here.
Pattern 1: Reflection
Multi-agent Reflection (Actor — Critic Framework)

The Reflection Pattern empowers AI agents to critique and refine their outputs through embedded self-assessment and correction mechanisms, leading to increased reliability and higher-quality results. This pattern can be implemented using different setups. One setup can be a single-agent reflection where one AI model performs the task and critiques its output, leveraging internal capabilities to identify and correct issues. We could also have a multi-agent reflection setup, where an Actoragent generates the output and a Critic agent reviews and refines it, enhancing the depth and quality of analysis. Another common way to do this is to leverage external tools integrated into the process to validate specific aspects of the output. For instance, in one of our previous NLtoSQL article, executing the generated SQL queries validated their correctness. Lastly, human-in-the-loop reflection allows incorporating human feedback for tasks requiring subjective judgment, ensuring a balanced and comprehensive refinement process.

Our implementation for this article follows the multi-agent Reflection route. The Actor generates initial drafts based on a given topic and refines these drafts based on detailed feedback from the Critic, maintaining a version history. This iterative process builds on each previous iteration, progressively polishing the content. The Actor utilizes specialized components: a DraftGenerator for creating initial versions and a RevisionGenerator for refining drafts based on feedback. The Critic acts as a content reviewer, assessing drafts, providing suggestions, and considering the entire content history to maintain consistency and track progress.

We also have a central Runner that orchestrates the whole interaction between the Actorand Critic, managing state across multiple cycles of generation and review. This Runner coordinates the entire workflow, ensuring systematic progress while maintaining a comprehensive history of all drafts and reviews. By managing the generation-review-revision loop, the Runner enables continuous refinement until the final output meets the desired quality.

A 100-foot overview of the workflow in action can be seen below. The Reflection Pattern illustrates how agentic workflows can drive iterative improvement through collaborative feedback, making it a robust framework for applications requiring progressive refinement and self-improving systems. The full implementation for the Reflection Pattern can be found here.

Now let’s take a look at the generated results of the workflow we have set up. We have three important modules: actor, critic, and pipeline. The actor encapsulates all the logic we need for generating a blog draft given any topic of your choice. Similarly, critic examines the generated draft and provides feedback on its strengths, weaknesses, and issues. The pipeline module coordinates this feedback loop for the user-provided number of cycles.

You can experiment with this setup. Depending on the complexity and length of the topic provided by the user — which can be a word or a phrase — we can see improvements extend beyond three cycles. For a short, common topic, we typically converge easily in about three cycles. Below, you can see three cycles for the topic, alternating between actor and critic, and how we arrive at the final, complete draft.
Actor generated Draft — Cycle 1
Critic Feedback — Cycle 1
Actor generated Draft — Cycle 2
Critic Feedback — Cycle 2
Actor generated Draft — Cycle 3
Critic Feedback — Cycle 3

Enhanced visualizations that clearly illustrate the distinctions between drafts v1 and v2.

Comparison of drafts v2 and v3 (final)
Pattern 2 - Web Access

The Web Access Pattern is an agentic workflow designed to streamline the retrieval, processing, and summarization of web content. This pattern leverages specialized agents, each dedicated to specific tasks within a well-coordinated pipeline. It efficiently orchestrates the entire process of searching, scraping, and summarizing web content, relying on external APIs for web searches and advanced language models for generating queries and summaries.

The workflow is initiated by a WebSearchAgent, which takes user input and formulates optimized search queries using language models. These queries are then executed using the SERP API to retrieve Google Search results. The agent ensures that the results are stored in a structured format, ready for the next stage of the pipeline. It also uses Gemini with function calling to determine the appropriate parameters for invoking Google Search via the SERP API.

Once the search phase is complete, the WebScrapeAgenttakes over. This agent is responsible for extracting content from the retrieved search results while handling multiple requests concurrently. It implements rate-limited scraping protocols to respect server limits and avoid disruptions. The extracted content is carefully processed and cleaned, resulting in structured data that serves as input for summarization.

At this stage, the WebContentSummarizeAgentsteps in. Using templated prompts and language models, this agent generates concise and consistent summaries from the extracted content. The summarization output is saved as the final result, marking the completion of the workflow.

The entire system is managed by a pipeline, which coordinates the execution of all the agents and ensures smooth data flow between components. The pipeline also handles cleanup tasks, manages error recovery, and provides a simple interface for initiating the workflow. This well-structured approach abstracts the complexity of web content processing, allowing users to execute the entire pipeline with a single function call.

This comprehensive design of the Web Access Pattern enables efficient and reliable web content acquisition and processing, making it an ideal solution for scenarios requiring structured and concise content generation from the vast resources available on the web. The key idea is to create a unified serial pipeline of three agents coordinating the process of taking a user-provided query and arriving at a comprehensive summary derived from web search. This pipeline can serve as a tool for use by later agents and patterns (pipelines). You’ll find the complete implementation for this pattern at this location.

Now let’s examine the outputs for each stage of the pipeline from the setup agents. The initial search query we’re going to test is “best hotels in Fresno, California”.

Below are the Google Search results returned by the WebSearchAgent.

Next, the WebScrapeAgenttakes the top k results from the previous agent and scrapes the individual webpages. It then cleans the HTML and consolidates it into a nice markup using Gemini, as shown below. Webpages that can’t be scraped are ignored. A portion of the scraped and assembled markdown is shown below:

Finally, the WebContentSummarizeAgenttakes the above markdown output from the previous agent and rewrites it into a more human-friendly user format.
Pattern 3: Semantic Routing
Routing based on user intent

The Semantic Routing pattern implements an agentic workflow for intelligently routing user queries to specialized agents based on the provided user intent. This pattern uses a coordinator-delegate architecture with a conditional router where a main TravelPlannerAgentdetermines the user’s intent and routes requests to specialized sub-agents for specific travel-related tasks like flight booking, hotel searches, and car rentals. By utilizing language models for intent detection and query processing, this pattern ensures that each request is managed by the most relevant specialized agent.

At the heart of the pattern is the TravelPlannerAgent, which serves as the central coordinator. This agent performs semantic analysis on incoming user queries to identify the intent, classifying it into predefined categories such as FLIGHT, HOTEL, CAR_RENTAL, or UNKNOWN. Based on this classification, the planner routes the query to the appropriate specialized sub-agent. It also oversees communication between sub-agents, consolidating their responses into a cohesive and user-friendly final output.

The workflow involves several specialized Sub-Agents, each dedicated to specific travel tasks. The FlightSearchAgenthandles all flight-related queries by generating optimized flight search parameters and returning summarized flight information. Similarly, the HotelSearchAgentprocesses hotel booking requests and provides relevant accommodation information, while the CarRentalSearchAgentmanages car rental inquiries, offering details on vehicle rental options. Each sub-agent specializes in handling specific travel tasks efficiently and providing accurate results. These sub-agents leverage the web access pipeline we set up previously in pattern 2 to retrieve and summarize web search results.

The pipelineis responsible for orchestrating the entire workflow. It initializes all agents and manages the overall flow of messages. The process flow begins with query reception, where the user submits a travel-related query, which is then converted into a message object by the pipeline and forwarded to the TravelPlannerAgent. During the intent detection phase, the TravelPlannerAgentanalyzes the semantic content of the query and determines the specific travel intent. It then routes the query to the most appropriate specialized sub-agent. In the specialized processing phase, the selected sub-agent (only one is elected based on the conditioned intent match) processes the routed query, generates an optimized web search query, and summarizes the web results to provide a detailed response. Once the sub-agent returns its response, the planner takes over for response consolidation, merging the information from the sub-agent and formatting a final, user-friendly response. All sub-agents (delegates) alongside the coordinator use LLM as their cognitive component for solving the Natural Language Understanding (NLU) task provided to them.

Beyond the travel planning use case example discussed here, conditional routing based on semantic intent is useful in various other use cases. For instance, in customer support, inquiries can be routed to appropriate departments such as billing, technical support, or sales based on the content of customer messages. In e-commerce, product-related queries can be directed to specific product specialists or recommender systems depending on the type of product mentioned. Healthcare systems can benefit from this pattern by triaging patient inquiries to appropriate medical specialists based on the symptoms or concerns expressed. The complete code for implementing this pattern can be found here.

Now let’s look into the results of the workflow for an example query as shown below:

Initially, the TravelPlannerAgentidentifies the correct intent as hotel search (see output below) and routes the control to the HotelSearchAgent.

The sub-agent then reformulates the original query into a web search query better suited for web search.

The sub-agent then makes the API call using the web access pipeline (pattern 2) to generate a summary (as shown below) for the hotel search we are looking for.

The HotelSearchAgentreturns the summarized web results back to the TravelPlannerAgent— the coordinator agent which then consolidates the final results into a more user-friendly, human-readable format (shown below) that is returned to the user.
Pattern 4: Parallel Delegation

The Parallel Delegation Pattern is an agentic workflow designed to handle complex queries by identifying distinct entities or insights through LLM-powered NLU and distributing them to specialized agents for concurrent processing. This pattern is especially effective in scenarios where multiple independent sub-tasks can be executed simultaneously. For example, we can apply this to the travel planning use case discussed in Pattern 3 — where searches for flights, hotels, and car rentals can be carried out in parallel. By leveraging asynchronous processing, this pattern optimizes performance while maintaining a coordinated and structured workflow through a central coordinating agent.

Similar to the previous pattern, at the heart of this pattern is the TravelPlannerAgent, which acts as the main coordinator. It performs Named Entity Recognition (NER) on user queries to identify key elements like flights, hotels, and car rentals. The agent then categorizes these entities and distributes them to specialized sub-agents for parallel processing. The planner oversees this asynchronous delegation process and compiles the results into a comprehensive final response for the user. This approach allows for efficient handling of complex travel planning requests by breaking them down into manageable, parallel tasks.

The Specialized sub-agents in this pattern are designed to process specific types of entities independently. The FlightSearchAgent handles flight-related entities, generating optimized flight search queries and retrieving relevant information. Similarly, the HotelSearchAgent manages hotel-related entities by processing accommodation requests and providing the required details. The CarRentalSearchAgent handles vehicle rental requests independently, offering relevant car rental options.

The async pipeline orchestrates the entire parallel workflow. It initializes all agents and manages asynchronous message flows between them. By enabling concurrent processing, the pipeline allows each specialized sub-agent to execute its tasks independently and in parallel, leading to substantial gains in efficiency. Thus, this pattern presents a scalable approach to handling complex workflows with multiple independent tasks. It is particularly useful in dynamic environments like travel planning, where tasks can be split into parallel components for optimized execution. Full code for this pattern is available in this location.

Now let’s examine the results for an example user query we input into our previously set up pipeline. Note that the query below can’t be pinned to a single intent — it has intents that touch all 3 sub-agents. However, before we trigger these agents, we need to break this query into entities (pieces) that can be passed to the appropriate agent.

The first step is executed by the coordinator (TravelPlannerAgent). It takes the query and, with the help of Gemini, decides the right entities that can be extracted to be passed on to the sub-agents.

This information is then passed on to the sub-agents to perform all three searches in parallel asynchronously. Each sub-agent first reformulates the original query into a more digestible form better suited for Google Search. We leverage Google Search here through tool use by accessing the web access pipeline we built in pattern 2. The search result summary is then passed back to the coordinator (TravelPlannerAgent). Ultimately, once the TravelPlannerAgent receives all the summaries from each of the sub-agents, it performs the consolidation to arrive at the final summary that is returned to the user.
Flight Search

    Reformulated Query

    Search Results Summary

Hotel Search

    Reformulated Query

    Search Results Summary

Car Rental Search

    Reformulated Query

    Search Results Summary

TravelPlannerAgent Consolidation

    Final Summary (returned to the user)

Pattern 5: Dynamic Sharding

The Dynamic Sharding Pattern represents an architectural approach that has evolved from traditional software design to embrace agent-based systems, where workloads are intelligently and dynamically divided into smaller units called “shards.” While this pattern traditionally excels in managing large datasets through concurrent processing, its adaptation to agentic settings introduces a more sophisticated layer of workload distribution. By intelligently partitioning tasks among agents, the system achieves enhanced scalability and optimal resource utilization.

At the heart of the pattern is the Coordinator agent, which orchestrates the entire data processing workflow. The Coordinator receives a complete list of items to process — for our demo purposes, we’ll use celebrity names in a web search scenario — along with a specified shard size. Its main job is to divide this list into smaller, more manageable shards. For instance, if the list contains 100 celebrity names and the shard size is 10, the Coordinator agent would create 10 separate shards. Once established, the Coordinator dynamically creates specialized shard processing Delegate agents for each shard and kicks off parallel processing, delegating these agents to handle their respective shards independently.

Note that even though we call the Coordinator an agent, we are not leveraging an LLM in this implementation to pre-process the original user-provided list. This can easily be implemented for some functionality that we might require before we do the sharding. One example could be cleaning the list — better organized or even given a chunk of free text — extract the entities, here celebrity names, as a first step happening inside the coordination agent. This is something you can try to implement.

The shard processing Delegate agents are specialized components designed to handle individual shards. These agents receive a subset of data from the Coordinator agent and independently process each item within their assigned shard. For instance, in a project where biographies of celebrities are fetched, each shard processing agent would focus on retrieving information for its designated set of celebrities. The agents operate concurrently, performing item-level processing to maximize efficiency. This fine-grained parallelism not only enhances processing speed but also simplifies error handling and retry mechanisms at the shard level, allowing for better resource isolation and management.

As each Delegate agent completes its tasks, the results are collected and returned to the Coordinator agent. The Coordinator then consolidates these results from all the agents into a unified, coherent response. This final step ensures that all the processed data is aggregated into a single, comprehensive output, which is then delivered to the original requester — whether that’s a user or another system component.

The Dynamic Sharding Pattern demonstrates a scalable approach to data processing that dynamically adjusts to varying workloads. By dividing tasks into shards and processing them concurrently through specialized agents, this pattern achieves significant improvements in system responsiveness, throughput, and resource utilization. It’s particularly well-suited for applications that deal with large datasets or high-volume requests, where efficient and scalable processing is critical. All code for this pattern can be found here.

A high-level view of the workflow is shown below:

Now let’s examine the results of the workflow. The input to the pipeline for this pattern is essentially a flat list of celebrity names. This list is given to the Coordinator agent to initiate the sharding and information gathering process.

The coordinator shards and performs web searches using the web access pipeline we set up in Pattern 2 to collect all the individual search summaries first. These individual summaries are then retrieved back to the coordinator agent. The coordinator doesn’t use an LLM to post-process or consolidate responses from sub-agents (delegates). However, this feature could be implemented if desired.

The final consolidated summary is shown below.
Pattern 6: Task Decomposition

The Task Decomposition Pattern is a design approach that manages complex tasks by breaking them down into multiple independent subtasks, which are then executed in parallel. This pattern relies on a central Coordinator agent to oversee the task decomposition and execution. Unlike other patterns where the tasks might be automatically identified, here the user defines and provides the specific subtasks alongside the input. The Coordinator then assigns these subtasks to specialized Delegate agents to process them concurrently. By efficiently dividing the workload, the Task Decomposition Pattern enhances scalability and optimizes resource usage, making it suitable for scenarios involving complex, multi-part tasks.

At the core of this pattern is the Coordinator, which plays a central role in receiving the complex task input along with the user-defined subtasks. It is responsible for managing the decomposition of the main task into smaller, independently executable units. It initiates the workflow by creating individual Delegate agents for each defined subtask. The Coordinator also sends the details of each subtask to the corresponding Delegate agent and then orchestrates their concurrent execution. Once all sub-agents have completed their assigned tasks, the Coordinator agent consolidates the results into a structured, unified output.

Each Delegate agent operates independently and processes a specific subtask assigned by the Coordinator agent. When a Delegate receives a subtask, it extracts the necessary details and prepares input for LLM if needed. The agent then processes the subtask by interacting with the LLM or any other necessary service and generates a result. After completing its task, the Delegate returns the result back to the Coordinator agent.

By breaking down complex tasks into smaller, independently executable units and processing them concurrently, the Task Decomposition Pattern enables a modular approach to task management, allowing each subtask to be processed in parallel while maintaining a cohesive and well-organized workflow. This pattern is particularly beneficial in scenarios where complex tasks can be logically divided into smaller, self-contained components that can be executed simultaneously. All supporting code covering this pattern is available here.

Note: The Coordinator agent in our implementation does not leverage LLM (Gemini) for any pre-processing logic or post-processing for consolidation. However, this can easily be added depending on your use case.

Now let’s examine the results of passing a legal public case document into this workflow with 5 clearly defined subtasks provided by the user. The Coordinator agent takes both the legal document and the user-provided task list. Depending on the number of tasks in the list, it spawns sub-agent delegates to perform the tasks. All the tasks are designed to be independent, hence the processing is done in parallel. The input document and the task list provided are shown below.
Input Document
User Provided Task List

A snapshot of the final output is shown below. The Coordinator receives the individual outputs from the sub-agents, which are then simply coalesced to stitch together the final output. Note that we aren’t using an LLM for consolidation in the current implementation, but this can easily be implemented.
Final Output
Pattern 7: Dynamic Decomposition

The Dynamic Decomposition Pattern is an advanced design approach where a central Coordinator Agent autonomously breaks down a complex task into multiple subtasks without relying on predefined structures. This pattern leverages an LLM to dynamically generate subtasks, which are then delegated to separate Delegate agents for parallel processing. After all subtasks are completed, the Coordinator gathers and combines the results into a structured summary, delivering a cohesive and comprehensive output. The key difference between this pattern and the previous one is that here, the coordinator can derive the subtasks automatically using an LLM (like Gemini), whereas in the previous pattern, the subtasks list was provided by a human to the coordinator.

The central component in this pattern is the Coordinator agent, which plays a pivotal role in analyzing and managing the entire task decomposition process. It begins by receiving the complex task input and using the LLM to identify the necessary subtasks. The Coordinator dynamically determines these subtasks based on the context of the input, allowing it to handle tasks with varied or undefined structures. Once the decomposition is complete, the Coordinator creates individual Delegate agents and assigns each subtask to a corresponding agent. These sub task agents then operate concurrently, processing their assigned tasks and returning results back to the Coordinator. The Coordinator finally consolidates these results into a structured summary that provides a comprehensive output for the original task.

The Delegate agents are responsible for executing the individual subtasks assigned by the Coordinator. Upon receiving a subtask, each Delegate agent prepares the relevant input and interacts with the LLM to either perform analysis or extract information. By delegating the execution of subtasks to independent Delegate agents, the pattern enables concurrent processing, which improves efficiency and reduces the overall task execution time. Each sub task agent returns its result to the Coordinator once its task is complete. This segment of the workflow mirrors what we previously explored in Pattern 6. Full code for Pattern 7 can be found at this location in the shared repo.

Let’s now examine the results of passing a document similar to what we did with user-facilitated task decomposition in Pattern 6. Here, instead of providing a subtask list alongside the input document to the Coordinator agent, we prompt the Coordinator agent to extract the subtasks itself, leveraging Gemini after analyzing the provided input (short story).

Our workflow’s input document is a digital text version of “The Old Man of the Sea” obtained from Project Gutenberg.
Identified Sub Tasks

The extracted sub tasks by the Coordinator are as follows:

Given that the Coordinator agent has extracted 10 subtasks to be performed on the short story, it also spawns 10 Delegate agents (allocating one task to each). The subtasks are then executed in parallel by the Delegate agents. Finally, the Coordinator consolidates all the outputs of the individual Delegate agents into one final summarized output.
Pattern 8: DAG Orchestration

The last pattern we are going to see is the DAG Orchestration Pattern. This is an advanced design approach for managing complex workflows by structuring tasks in a Directed Acyclic Graph (DAG) format. This pattern allows for the flexible and efficient execution of multiple tasks, supporting both parallel and sequential execution based on dependencies defined in a DAG. The pattern leverages a Coordinator Agent, as in previous patterns, to dynamically manage task execution according to the defined workflow, using a YAML-based configuration to specify task relationships, execution order, and associated agents.

As before, the central component of this pattern is the Coordinatorwhich oversees the entire execution process. The Coordinator agent begins by reading and parsing a YAML file containing the DAG definition, loading the tasks, their dependencies, and the associated sub-agents into memory. This flexible structure allows the workflow to be easily customized, updated, and extended without changing the underlying code, making it adaptable for a wide range of complex workflows.

Key to the workflow are specialized sub-agents like CollectAgent, PreprocessAgent, ExtractAgent, SummarizeAgent, and CompileAgent, each responsible for specific tasks within the workflow. The CollectAgent is responsible for gathering documents from specified folders and preparing them for further processing. Once the documents are collected, the PreprocessAgent steps in to clean and normalize their content using an LLM. The ExtractAgent then extracts key information, such as characters, themes, or plot points, from the preprocessed documents. This extracted information is then summarized by the SummarizeAgent, which generates concise summaries. Finally, the CompileAgent compiles a comprehensive report based on the extracted key information and the generated summaries.

The orchestration pattern follows a structured process flow, starting with DAG definition loading. During this initial step, the Coordinator agent reads and parses the YAML file, loading the DAG structure into memory and identifying all tasks, dependencies, and related agents. Once the DAG is loaded, the task execution preparation phase begins, where the Coordinator initializes the task states and prepares a list of pending tasks.

In the final iterative task execution phase, the Coordinator agent enters a loop that continues until all tasks are completed. During each iteration, the Coordinator identifies tasks that have all their dependencies satisfied, marking them as executable. For each executable task, the appropriate sub-agent is dynamically created based on the task definition, and input data is collected from the results of previously completed tasks. The sub-agent then processes the task asynchronously. As the Coordinator waits for these tasks to complete, it monitors their progress and collects results, updating task states accordingly.

The DAG orchestration pattern is a powerful solution for scenarios requiring flexible and structured task execution, where dependencies must be managed dynamically, and tasks can be executed in both parallel and sequential configurations. All code covering this advanced pattern alongside supporting files can be found here.

A 100 foot view of the workflow in action is shown below.

Now let’s explore an example use case and how the orchestration works in practice with respect to the workflow pattern we discussed above.

Our input is a collection of short stories. The goal of the DAG pipeline is to consume these stories in a step-by-step fashion and execute the previously defined subtasks via the defined Delegate agents. The Coordinator agent drives the whole process. Sample input short stories are shown below.

The declarative YAML for the example DAG workflow we are going to set up for this example is as follows:

Here, each task depends on the previous one, with one exception: Task 5 (compile task) depends on both Task 3 and Task 4 (extract and summarize tasks). This means we can execute Tasks 3 and 4 independently and in parallel before feeding their results into Task 5. Below, we share the intermediate outputs from the subtask (Delegate) agents.
Task 1
Task 2
Task 3
Task 4
Task 5 (Final Output)

The final output (from Task 5) is a literary analysis report that summarizes the input short stories we started with in a very specific manner, aligned to the original requirements put forth in the initial request, as seen below.
Closing Thoughts

The rapid evolution of AI and LLMs has given rise to new challenges and opportunities in designing agentic workflows. Patterns like Reflection, Web Access, Semantic Routing, and Parallel Delegation, among others, offer robust frameworks for building sophisticated and adaptive AI systems. These patterns not only enhance efficiency but also enable scalability, dynamic adaptability, and autonomous self-improvement in AI applications. By understanding and applying these agentic workflow patterns, practitioners can unlock the full potential of AI, crafting intelligent solutions for diverse real-world problems.

This guide is just the starting point in a larger conversation about agentic workflows. We encourage AI researchers and practitioners to explore these patterns, adapt them to their needs, and contribute to this evolving field. Also, this article presents one approach to implementing agentic workflows, but it’s not the only way. There are many other methods to build and combine agent-based workflows. The aim of this article was to demonstrate simple implementations that are pure and give you full control to customize and experiment without relying on external frameworks designed for this purpose. The eight patterns discussed can be combined to create more advanced variations. We can even make the simple agents ReAct-like, as explored in a previous article. If you have new pattern ideas or feel something is missing, feel free to reach out. Let’s collaborate to continue growing and refining this field.

Thanks for reading the article and for your engagement. Your follow and claps mean a lot. If you have any questions or doubts about the content or the shared notebooks, feel free to contact me at arunpshankar@google.com or shankar.arunp@gmail.com. You can also find me on https://www.linkedin.com/in/arunprasath-shankar/

I welcome all feedback and suggestions. If you’re interested in large-scale ML, NLP or NLU, and eager to collaborate, I’d be delighted to connect. Moreover, if you’re an individual, startup, or enterprise seeking to comprehend Google Cloud, VertexAI, and the various Generative AI components and their applications in NLP/ML, I’m here to assist. Please feel free to reach out.



