import { StateGraph, END, START } from "@langchain/langgraph";
import { AzureChatOpenAI } from "@langchain/openai";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { z } from "zod";
import { VM } from "vm2";
import * as dotenv from "dotenv";
import {
  Context,
  Effect,
  Layer,
  Config,
  Console,
  pipe,
  ReadonlyArray,
  Either,
} from "effect";

dotenv.config(); // Still needed for dotenv to load into process.env

// 0. Configuration Management (Effect Best Practice)
// Define what configuration your application needs using Config module
interface AppConfig {
  azureOpenAIApiKey: string;
  azureOpenAIApiInstanceName: string;
  azureOpenAIApiDeploymentName: string;
  azureOpenAIApiVersion: string;
  openAITemperature: number;
}

const AppConfig = Config.struct({
  azureOpenAIApiKey: Config.string("AZURE_OPENAI_API_KEY"),
  azureOpenAIApiInstanceName: Config.string("AZURE_OPENAI_API_INSTANCE_NAME"),
  azureOpenAIApiDeploymentName: Config.string(
    "AZURE_OPENAI_API_DEPLOYMENT_NAME",
  ),
  azureOpenAIApiVersion: Config.string("AZURE_OPENAI_API_VERSION"),
  openAITemperature: pipe(
    Config.string("OPENAI_TEMPERATURE"), // Assuming temperature can come from env as string
    Config.map((s) => parseFloat(s)),
    Config.withDefault(0.7), // Default if not provided or invalid
  ),
});

// Create a Layer that provides the AppConfig
const AppConfigLive = Layer.effect(
  AppConfig, // The Tag representing the config type
  AppConfig, // The Effect that fetches the config
);

// 1. Define the Agent State (remains largely the same, but messages are readonly)
interface AgentState {
  messages: ReadonlyArray<HumanMessage | AIMessage>; // Use ReadonlyArray for immutability
  generatedCode?: string;
  evaluationResult?: string;
}

// 2. Define Services (Effect Best Practice: Encapsulate external interactions in Services)

// 2a. LLM Service
class LLMService extends Context.Tag("LLMService")<
  LLMService,
  {
    readonly invokeChat: (
      messages: ReadonlyArray<HumanMessage | AIMessage>,
    ) => Effect.Effect<
      AIMessage,
      Error, // Specific errors from LLM can be defined here, e.g., LLMAPIError
      never // LLMService itself doesn't have runtime dependencies
    >;
  }
>() { }

const LLMServiceLive = Layer.effect(
  LLMService,
  // We need AppConfig to build the LLM client
  Effect.gen(function* () {
    const config = yield* AppConfig; // Get AppConfig from the environment

    const llm = new AzureChatOpenAI({
      modelName: "gpt-4o",
      azureOpenAIApiKey: config.azureOpenAIApiKey,
      azureOpenAIApiInstanceName: config.azureOpenAIApiInstanceName,
      azureOpenAIApiDeploymentName: config.azureOpenAIApiDeploymentName,
      azureOpenAIApiVersion: config.azureOpenAIApiVersion,
      temperature: config.openAITemperature,
    });

    return LLMService.of({
      invokeChat: (messages) =>
        Effect.tryPromise({
          try: () => llm.invoke(messages).then((response) => new AIMessage(response.content)),
          catch: (error) => new Error(`LLM invocation failed: ${error}`), // Convert unknown errors to Error
        }),
    });
  }),
);

// 2b. Code Execution Service
class CodeExecutionService extends Context.Tag("CodeExecutionService")<
  CodeExecutionService,
  {
    readonly executeCode: (
      code: string,
    ) => Effect.Effect<string, Error, never>; // Returns string result or an Error
  }
>() { }

const CodeExecutionServiceLive = Layer.succeed(
  CodeExecutionService,
  CodeExecutionService.of({
    executeCode: (code) =>
      Effect.try({
        try: () => {
          const vm = new VM({
            timeout: 1000,
            sandbox: {},
          });
          const wrappedCode = `${code}\n\nmodule.exports = execute();`;
          const vmResult = vm.run(wrappedCode);
          return `Execution successful. Result: ${JSON.stringify(vmResult)}`;
        },
        catch: (error: unknown) =>
          new Error(`Code execution failed. Error: ${(error as Error).message}`),
      }),
  }),
);

// 3. Define the "Generate Code" Node as an Effect
const generateCodeNode = (state: AgentState): Effect.Effect<Partial<AgentState>, Error, LLMService> =>
  Effect.gen(function* () {
    const llmService = yield* LLMService; // Access the LLM service from the environment

    const lastHumanMessage = pipe(
      state.messages,
      ReadonlyArray.last,
      // Handle the case where there's no last message or it's not a HumanMessage
      // This is a defensive check; in your graph, it should always be present.
      Effect.map((msg) => (msg instanceof HumanMessage ? msg.content : "No user request provided")),
      Effect.orElseSucceed(() => "No user request provided"),
    );

    const prompt = `You are a helpful AI assistant that writes simple TypeScript code.
The user wants to perform a calculation or a simple task.
Generate TypeScript code that fulfills the user's request.
The code should be a self-contained function named 'execute' that takes no arguments and returns a string or number.
Do NOT include imports, just the function.

Example:
User Request: "Add 5 and 3"
\`\`\`typescript
function execute(): number {
  return 5 + 3;
}
\`\`\`

User Request: "${yield* lastHumanMessage}"
\`\`\`typescript
`;

    const response = yield* llmService.invokeChat([new HumanMessage(prompt)]);
    const generatedCode = response.content.toString().match(/```typescript\n([\s\S]*?)```/)?.[1]?.trim();

    if (!generatedCode) {
      yield* Console.error("Failed to extract TypeScript code from LLM response.");
      return {
        messages: ReadonlyArray.append(state.messages, new AIMessage("I couldn't generate valid TypeScript code from your request.")),
      };
    }

    yield* Console.log("Generated Code:\n", generatedCode);

    return {
      messages: ReadonlyArray.append(state.messages, new AIMessage(`I've generated the following TypeScript code:\n\`\`\`typescript\n${generatedCode}\n\`\`\``)),
      generatedCode: generatedCode,
    };
  });

// 4. Define the "Evaluate Code" Node as an Effect
const evaluateCodeNode = (state: AgentState): Effect.Effect<Partial<AgentState>, Error, CodeExecutionService> =>
  Effect.gen(function* () {
    const codeExecutionService = yield* CodeExecutionService; // Access the CodeExecution service

    const code = state.generatedCode;
    if (!code) {
      return {
        messages: ReadonlyArray.append(state.messages, new AIMessage("No code was generated to evaluate.")),
      };
    }

    const evaluationResult = yield* codeExecutionService.executeCode(code).pipe(
      // Catch and handle the error from code execution
      Effect.catchAll((error) =>
        Effect.succeed(`Code execution failed. Error: ${error.message}`),
      ),
    );

    yield* Console.log("Evaluation Result:\n", evaluationResult);

    return {
      messages: ReadonlyArray.append(state.messages, new AIMessage(`Code Evaluation Result:\n${evaluationResult}`)),
      evaluationResult: evaluationResult,
    };
  });

// 5. Define the Graph (LangGraph nodes need to be async functions, so we wrap our Effects)
// This is an "impure edge" where Effect is run, as LangGraph doesn't understand Effect directly.
// In a pure Effect-based system, the graph itself might be an Effect.
const generateCodeNodeEffectWrapper = async (state: AgentState): Promise<Partial<AgentState>> =>
  Effect.runPromise(
    generateCodeNode(state).pipe(
      // We need to provide the dependencies for this specific Effect execution
      Effect.provide(LLMServiceLive),
      Effect.provide(AppConfigLive),
      // Catch any unhandled errors before they escape to LangGraph
      Effect.catchAll((e) => {
        console.error("Unhandled error in generateCodeNode:", e);
        return Effect.succeed({
          messages: ReadonlyArray.append(state.messages, new AIMessage(`An internal error occurred during code generation: ${e.message}`)),
        });
      }),
    ),
  );

const evaluateCodeNodeEffectWrapper = async (state: AgentState): Promise<Partial<AgentState>> =>
  Effect.runPromise(
    evaluateCodeNode(state).pipe(
      // We need to provide the dependencies for this specific Effect execution
      Effect.provide(CodeExecutionServiceLive),
      // Catch any unhandled errors before they escape to LangGraph
      Effect.catchAll((e) => {
        console.error("Unhandled error in evaluateCodeNode:", e);
        return Effect.succeed({
          messages: ReadonlyArray.append(state.messages, new AIMessage(`An internal error occurred during code evaluation: ${e.message}`)),
        });
      }),
    ),
  );

export const workflow = new StateGraph<AgentState>({
  channels: {
    messages: {
      value: (x: ReadonlyArray<HumanMessage | AIMessage>, y: ReadonlyArray<HumanMessage | AIMessage>) => ReadonlyArray.concat(x, y),
      default: () => ReadonlyArray.empty(),
    },
    generatedCode: {
      value: (x?: string, y?: string) => y ?? x,
      default: () => undefined,
    },
    evaluationResult: {
      value: (x?: string, y?: string) => y ?? x,
      default: () => undefined,
    },
  },
})
  .addNode("generate_code", generateCodeNodeEffectWrapper)
  .addNode("evaluate_code", evaluateCodeNodeEffectWrapper)
  .addEdge("generate_code", "evaluate_code")
  .addEdge("evaluate_code", END)
  .addEdge(START, "generate_code");

export const app = workflow.compile();

// Example Usage (Effect-ified runWorkflow)
const runWorkflow = (prompt: string) =>
  Effect.gen(function* () {
    yield* Console.log(`Running workflow for prompt: "${prompt}"`);
    const finalState = yield* Effect.tryPromise({
      try: () => app.invoke({ messages: ReadonlyArray.of(new HumanMessage(prompt)) }),
      catch: (e) => new Error(`Workflow invocation failed: ${e}`),
    });
    yield* Console.log(
      "Final State:",
      pipe(
        finalState.messages,
        ReadonlyArray.map((msg) => msg.content),
        ReadonlyArray.join("\n"),
      ),
    );
  });

// Run some examples
pipe(
  runWorkflow("Write a TypeScript function that calculates the factorial of 5."),
  Effect.flatMap(() => Effect.log("\n--- Next Workflow ---\n")),
  Effect.flatMap(() => runWorkflow("Create a function that returns the string 'Hello, LangGraph!'")),
  Effect.flatMap(() => Effect.log("\n--- Next Workflow ---\n")),
  Effect.flatMap(() => runWorkflow("What is 10 divided by 2?")), // This will generate a simple arithmetic operation
  Effect.catchAll((e) => Console.error(`Application failed: ${e.message}`)), // Top-level error handling for the whole app
  Effect.runPromise, // Finally, run the entire Effect
);