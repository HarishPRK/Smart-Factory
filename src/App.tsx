import { FilterProvider } from "./context/FilterContext";
import { PLCProvider } from "./context/PLCContext";
import Dashboard from "./components/Dashboard";
import { useFitToWidth } from "./hooks/useFitToWidth";

function App() {
  // Scale the dashboard to its design width so OS display scaling (e.g. 125%)
  // renders the same proportions as a clean 100% display instead of truncating.
  useFitToWidth();

  return (
    <FilterProvider>
      <PLCProvider>
        <Dashboard />
      </PLCProvider>
    </FilterProvider>
  );
}

export default App;
