import { useState, useEffect } from "react";

const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"];
 const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:5000";
; // change if needed
const COLLECTIONS_STORAGE_KEY = "api_tester_collections_v1";

function App() {
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("");
  const [bodyText, setBodyText] = useState(
    `{\n  "title": "foo",\n  "body": "bar",\n  "userId": 1\n}`
  );
  const [headersText, setHeadersText] = useState(
    `{\n  "Content-Type": "application/json"\n}`
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [response, setResponse] = useState(null);
  const [responseTab, setResponseTab] = useState("body"); // body | headers | raw

  // ✅ Supabase history state
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ✅ Collections (localStorage)
  const [collections, setCollections] = useState([]); // [{id, name, items:[...]}]
  const [selectedCollectionId, setSelectedCollectionId] = useState(null);

  // --------- HISTORY (Supabase) ---------
  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`${BACKEND_URL}/history`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data);
      } else {
        setHistory([]);
      }
    } catch (e) {
      console.error("Failed to load history", e);
    } finally {
      setHistoryLoading(false);
    }
  };

  // --------- COLLECTIONS (localStorage) ---------
  const loadCollectionsFromStorage = () => {
    try {
      const raw = localStorage.getItem(COLLECTIONS_STORAGE_KEY);
      if (!raw) {
        setCollections([]);
        return;
      }
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setCollections(parsed);
      } else {
        setCollections([]);
      }
    } catch (e) {
      console.error("Failed to load collections from storage", e);
      setCollections([]);
    }
  };

  const saveCollectionsToStorage = (nextCollections) => {
    setCollections(nextCollections);
    try {
      localStorage.setItem(
        COLLECTIONS_STORAGE_KEY,
        JSON.stringify(nextCollections)
      );
    } catch (e) {
      console.error("Failed to save collections to storage", e);
    }
  };

  const createNewCollection = () => {
    const name = window.prompt("Enter collection name:");
    if (!name) return;
    const newCollection = {
      id: Date.now().toString(),
      name,
      items: [],
    };
    const next = [newCollection, ...collections];
    saveCollectionsToStorage(next);
    setSelectedCollectionId(newCollection.id);
  };

  const handleSelectCollection = (collection) => {
    setSelectedCollectionId(collection.id);
  };

  const saveCurrentRequestToCollection = () => {
    if (!collections.length) {
      window.alert("Create a collection first (bottom left)!");
      return;
    }
    if (!selectedCollectionId) {
      window.alert("Select a collection from the list to save into.");
      return;
    }
    if (!url) {
      window.alert("Enter a URL before saving to collection.");
      return;
    }

    let parsedHeaders = {};
    let parsedBody = {};

    // Try to reuse same JSON parsing rules
    if (headersText.trim()) {
      try {
        parsedHeaders = JSON.parse(headersText);
      } catch (e) {
        window.alert("Invalid JSON in Headers, cannot save.");
        return;
      }
    }

    if (method !== "GET" && method !== "DELETE" && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch (e) {
        window.alert("Invalid JSON in Body, cannot save.");
        return;
      }
    }

    const next = collections.map((col) => {
      if (col.id !== selectedCollectionId) return col;
      return {
        ...col,
        items: [
          {
            id: Date.now().toString(),
            url,
            method,
            headers: parsedHeaders,
            body: parsedBody,
            savedAt: new Date().toISOString(),
          },
          ...col.items,
        ],
      };
    });

    saveCollectionsToStorage(next);
    window.alert("Request saved to collection!");
  };

  const loadCollectionItemIntoForm = (item) => {
    setUrl(item.url || "");
    setMethod(item.method || "GET");
    setHeadersText(
      item.headers ? JSON.stringify(item.headers, null, 2) : "{\n  \n}"
    );
    setBodyText(
      item.body ? JSON.stringify(item.body, null, 2) : "{\n  \n}"
    );
  };

  // --------- INITIAL LOAD ---------
  useEffect(() => {
    loadHistory();
    loadCollectionsFromStorage();
  }, []);

  // --------- SEND REQUEST ---------
  const handleSend = async () => {
    setError("");
    setResponse(null);

    if (!url) {
      setError("Please enter a URL.");
      return;
    }

    let parsedHeaders = {};
    let parsedBody = {};

    if (headersText.trim()) {
      try {
        parsedHeaders = JSON.parse(headersText);
      } catch (e) {
        setError("Invalid JSON in Headers.");
        return;
      }
    }

    if (method !== "GET" && method !== "DELETE" && bodyText.trim()) {
      try {
        parsedBody = JSON.parse(bodyText);
      } catch (e) {
        setError("Invalid JSON in Body.");
        return;
      }
    }

    setLoading(true);

    try {
      const res = await fetch(`${BACKEND_URL}/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          method,
          headers: parsedHeaders,
          body: parsedBody,
          params: {},
        }),
      });

      const data = await res.json();
      setResponse(data);

      // refresh history after request is logged in Supabase
      loadHistory();
    } catch (err) {
      console.error(err);
      setError("Failed to reach backend proxy.");
    } finally {
      setLoading(false);
    }
  };

  const handleHistoryClick = (item) => {
    setUrl(item.url || "");
    setMethod(item.method || "GET");
    setHeadersText(
      item.headers ? JSON.stringify(item.headers, null, 2) : "{\n  \n}"
    );
    setBodyText(
      item.body ? JSON.stringify(item.body, null, 2) : "{\n  \n}"
    );
  };

  const formatJson = (value) => {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  };

  const selectedCollection = collections.find(
    (c) => c.id === selectedCollectionId
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-slate-800 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
            API
          </span>
          <h1 className="text-lg font-semibold tracking-tight">
            API Testing Tool
          </h1>
          <span className="text-xs text-slate-500 ml-2">
            (Mini Postman Clone)
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span>Logged out</span>
          <button className="px-3 py-1 rounded border border-slate-700 hover:bg-slate-800">
            Login / Signup
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-72 border-r border-slate-800 bg-slate-950/70 flex flex-col">
          {/* History */}
          <div className="p-3 border-b border-slate-800">
            <h2 className="text-sm font-semibold">History</h2>
            <p className="text-[11px] text-slate-500">
              Recent API requests (Supabase).
            </p>
            {historyLoading && (
              <p className="text-[11px] text-slate-500 mt-1">Loading...</p>
            )}
          </div>

          <div className="flex-1 overflow-auto p-2 space-y-1 text-xs">
            {!historyLoading && history.length === 0 && (
              <p className="text-[11px] text-slate-500">
                No history yet. Send a request.
              </p>
            )}

            {history.map((item) => (
              <button
                key={item.id}
                onClick={() => handleHistoryClick(item)}
                className="w-full text-left px-2 py-1 rounded hover:bg-slate-900 border border-transparent hover:border-slate-700 flex flex-col gap-0.5"
              >
                <div className="flex items-center gap-1">
                  <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px]">
                    {item.method}
                  </span>
                  <span className="truncate text-[11px]">{item.url}</span>
                </div>
                <span className="text-[10px] text-slate-500">
                  Status: {item.status ?? "-"}
                </span>
              </button>
            ))}
          </div>

          {/* Collections */}
          <div className="border-t border-slate-800">
            <div className="p-3 border-b border-slate-800">
              <h2 className="text-sm font-semibold mb-1">Collections</h2>
              <p className="text-[11px] text-slate-500 mb-2">
                Saved folders (localStorage).
              </p>

              <div className="max-h-28 overflow-auto text-xs space-y-1 mb-2">
                {collections.length === 0 && (
                  <p className="text-[11px] text-slate-500">
                    No collections yet.
                  </p>
                )}
                {collections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => handleSelectCollection(col)}
                    className={`w-full text-left px-2 py-1 rounded text-[12px] ${
                      selectedCollectionId === col.id
                        ? "bg-slate-800 border border-emerald-500/60"
                        : "hover:bg-slate-900 border border-transparent hover:border-slate-700"
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>

              <button
                onClick={createNewCollection}
                className="w-full text-xs px-2 py-1 rounded border border-dashed border-slate-600 hover:bg-slate-900"
              >
                + New Collection
              </button>
            </div>

            {/* Items of selected collection */}
            <div className="p-3 max-h-48 overflow-auto">
              <h3 className="text-xs font-semibold mb-1">
                {selectedCollection ? selectedCollection.name : "No collection selected"}
              </h3>
              {selectedCollection && selectedCollection.items.length === 0 && (
                <p className="text-[11px] text-slate-500">
                  No requests saved yet.
                </p>
              )}
              {selectedCollection &&
                selectedCollection.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadCollectionItemIntoForm(item)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-900 border border-transparent hover:border-slate-700 flex flex-col gap-0.5 mb-1"
                  >
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 font-mono text-[10px]">
                        {item.method}
                      </span>
                      <span className="truncate text-[11px]">{item.url}</span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      Saved: {new Date(item.savedAt).toLocaleString()}
                    </span>
                  </button>
                ))}
            </div>
          </div>
        </aside>

        {/* Request + Response area */}
        <main className="flex-1 flex">
          {/* Request Panel */}
          <section className="w-1/2 border-r border-slate-800 flex flex-col">
            {/* Request URL row */}
            <div className="p-3 border-b border-slate-800 space-y-2">
              <div className="flex gap-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs font-mono"
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-1 text-xs"
                  placeholder="https://jsonplaceholder.typicode.com/posts"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
                <button
                  className="bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold px-4 py-1 rounded disabled:opacity-50"
                  onClick={handleSend}
                  disabled={loading}
                >
                  {loading ? "Sending..." : "Send"}
                </button>
              </div>

              <div className="flex justify-between items-center">
                <p className="text-[11px] text-slate-500">
                  Enter the API URL, choose method, then click{" "}
                  <span className="font-semibold">Send</span>.
                </p>
                <button
                  onClick={saveCurrentRequestToCollection}
                  className="text-[11px] px-2 py-1 rounded border border-slate-700 hover:bg-slate-800"
                >
                  Save to Collection
                </button>
              </div>

              {error && (
                <p className="text-[11px] text-red-400 mt-1">{error}</p>
              )}
            </div>

            {/* Tabs hint (we can enhance later) */}
            <div className="px-3 pt-2 border-b border-slate-800 flex gap-3 text-xs">
              <button className="pb-1 border-b-2 border-emerald-500 text-emerald-400">
                Body
              </button>
              <button className="pb-1 border-b-2 border-transparent hover:border-slate-600 hover:text-slate-200">
                Headers
              </button>
              <button className="pb-1 border-b-2 border-transparent hover:border-slate-600 hover:text-slate-200">
                Query Params
              </button>
            </div>

            {/* Editors */}
            <div className="flex-1 p-3 space-y-3 overflow-auto text-xs">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Body (JSON)</h3>
                  <span className="text-[10px] text-slate-500">
                    Raw JSON editor
                  </span>
                </div>
                <textarea
                  className="w-full min-h-[160px] bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono"
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  disabled={method === "GET" || method === "DELETE"}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold">Headers (JSON)</h3>
                  <span className="text-[10px] text-slate-500">
                    Example: {"{ \"Content-Type\": \"application/json\" }"}
                  </span>
                </div>
                <textarea
                  className="w-full min-h-[100px] bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono"
                  value={headersText}
                  onChange={(e) => setHeadersText(e.target.value)}
                />
              </div>
            </div>
          </section>

          {/* Response Panel */}
          <section className="w-1/2 flex flex-col">
            <div className="p-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Response</h2>
              <div className="flex gap-3 text-[11px] text-slate-400">
                <span>
                  Status:{" "}
                  <span className="font-mono text-emerald-400">
                    {response ? `${response.status} ${response.statusText}` : "—"}
                  </span>
                </span>
                <span>
                  Time:{" "}
                  <span className="font-mono">
                    {response ? `${response.timeTaken} ms` : "—"}
                  </span>
                </span>
                <span>
                  Size:{" "}
                  <span className="font-mono">
                    {response ? `${(response.size / 1024).toFixed(2)} KB` : "—"}
                  </span>
                </span>
              </div>
            </div>

            <div className="px-3 pt-2 border-b border-slate-800 flex gap-3 text-xs">
              <button
                className={`pb-1 border-b-2 ${
                  responseTab === "body"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent hover:border-slate-600 hover:text-slate-200"
                }`}
                onClick={() => setResponseTab("body")}
              >
                Body
              </button>
              <button
                className={`pb-1 border-b-2 ${
                  responseTab === "headers"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent hover:border-slate-600 hover:text-slate-200"
                }`}
                onClick={() => setResponseTab("headers")}
              >
                Headers
              </button>
              <button
                className={`pb-1 border-b-2 ${
                  responseTab === "raw"
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent hover:border-slate-600 hover:text-slate-200"
                }`}
                onClick={() => setResponseTab("raw")}
              >
                Raw
              </button>
            </div>

            <div className="flex-1 p-3 overflow-auto text-xs">
              {!response && (
                <pre className="w-full h-full bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-[11px] text-slate-500">
{`// Send a request to see the response here.\n// You’ll see status, time, size, headers and body.`}
                </pre>
              )}

              {response && (
                <pre className="w-full h-full bg-slate-950 border border-slate-700 rounded px-3 py-2 font-mono text-[11px]">
                  {responseTab === "body" && formatJson(response.data)}
                  {responseTab === "headers" && formatJson(response.headers)}
                  {responseTab === "raw" && formatJson(response)}
                </pre>
              )}

              {response?.errorMessage && (
                <p className="mt-2 text-[11px] text-amber-400">
                  Note: {response.errorMessage}
                </p>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
