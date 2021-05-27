import { Flex, Box } from "theme-ui";
import { Link } from "./Link";
import Logo from './Logo'
import styled from 'styled-components';
import { NavLink } from "react-router-dom";

export const Nav: React.FC = () => {
  return (
    <Box as="nav" sx={{ display: ["none", "flex"], alignItems: "center", flex: 1 }}>
      <Logo />
      <Flex>
        <NavL exact activeClassName="active" to="/">
          Home
        </NavL>
        <NavL exact activeClassName="active" to="/risky-troves">
          Risky Loans
        </NavL>
        {/* <Link sx={{ fontSize: 1 }} to="/redemption">
          Redemption
        </Link> */}
      </Flex>
    </Box>
  );
};

const NavL = styled(NavLink)`
color: ${(props) => props.theme.color.grey[400]};
height: 69px;
display: flex;
justify-content: center;
align-items: center;
font-family: Inter;
font-style: normal;
font-weight: 600;
font-size: 14px;
line-height: 20px;
text-align: center;
color: rgba(255, 255, 255, 0.88);
padding-left: ${(props) => props.theme.spacing[3]}px;
padding-right: ${(props) => props.theme.spacing[3]}px;
text-decoration: none;
border-bottom: 2px solid transparent;
&:hover {
  color: #fff;
  background: linear-gradient(180deg, rgba(244, 127, 87, 0) 0%, rgba(253, 86, 86, 0.1) 100%);
  border-bottom: 2px solid rgba(253, 86, 86, 0.3);
  text-decoration: none;
}
&.active {
  border-bottom: 2px solid #f47f57;
  background: linear-gradient(180deg, rgba(244, 127, 87, 0) 0%, rgba(253, 86, 86, 0.1) 100%);
  color: #fff;
}
`;
