import { FilterProvider } from "./context/FilterContext";
import { PLCProvider } from "./context/PLCContext";
import Dashboard from "./components/Dashboard";

function App() {
  return (
    <FilterProvider>
      <PLCProvider>
        <Dashboard />
      </PLCProvider>
    </FilterProvider>
  );
}

export default App;
