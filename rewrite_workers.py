import re

with open('admin/src/modules/workers/Workers.jsx', 'r') as f:
    content = f.read()

# Add imports for Card, Table, Button
import_statement = "import Button from '../../components/common/Button'\nimport Card from '../../components/common/Card'\nimport Table from '../../components/common/Table'\nimport Badge from '../../components/common/Badge'\n"
content = content.replace("import MapPicker from '../../components/common/MapPicker'", import_statement + "import MapPicker from '../../components/common/MapPicker'")

# Replace table with Table component
# We have a manual table right now.
# We'll use a regex to grab the table block and replace it. But it might be complex.
# A simpler approach: use `replace` on the specific blocks.
