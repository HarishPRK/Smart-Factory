import { FilterProvider } from "./context/FilterContext";
import { PLCProvider } from "./context/PLCContext";
import UIVersionShell from "./components/ui-version/UIVersionShell";
import { UIVersionProvider } from "./components/ui-version/UIVersionProvider";

function App() {
  return (
    <UIVersionProvider>
      <FilterProvider>
        <PLCProvider>
          <UIVersionShell />
        </PLCProvider>
      </FilterProvider>
    </UIVersionProvider>
  );
}

export default App;
