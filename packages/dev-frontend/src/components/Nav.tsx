import { Flex, Box } from "theme-ui";
import { Link } from "./Link";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", flex: 1 }}>
      <Flex>
        <Link sx={{ fontSize: 1 }} to="/">
          Home
        </Link>
        <Link sx={{ fontSize: 1 }} to="/risky-troves">
          Risky Loans
        </Link>
        <Link sx={{ fontSize: 1 }} to="/redemption">
          Redemption
        </Link>
      </Flex>
    </Box>
  );
};
