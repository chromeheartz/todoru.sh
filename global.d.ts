export {};

declare global {
  /** A single to-do item (shared by main, preload, renderer). */
  interface Todo {
    id: number;
    text: string;
    done: boolean;
    createdAt: number;
  }

  /** A slash command in the renderer's command registry. */
  interface Command {
    name: string;
    aliases?: string[];
    args: string;
    desc: string;
    run: (rest: string) => void;
  }

  /** The API surface the preload script exposes on `window.api`. */
  interface TodoApi {
    loadTodos(): Promise<Todo[]>;
    saveTodos(todos: Todo[]): Promise<boolean>;
    closeWindow(): void;
    minimizeWindow(): void;
    /** Show on (and follow across) every desktop / over full-screen apps. */
    setPin(enabled: boolean): void;
  }

  interface Window {
    api: TodoApi;
  }
}
