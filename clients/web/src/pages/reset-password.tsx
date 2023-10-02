import { Text, Flex, useColorModeValue, Box, Heading, Link } from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';

import { DefaultLayout } from '../layouts';
import { useUserActions } from '../hooks';
import { SoftCard } from '../components/generic/SoftCard';
import { ResetPasswordForm } from '../components/forms/ResetPassword';

export const ResetPasswordPage: React.FC = () => {
  const { resetPassword } = useUserActions();

  const titleColor = useColorModeValue('teal.400', 'teal.200');
  const textColor = useColorModeValue('gray.600', 'white');
  const linkColor = useColorModeValue('teal.400', 'teal.200');

  const onSubmit = async ({ email }: { email: string }) => resetPassword(email);

  return (
    <DefaultLayout displayLogo>
      <Flex width="100%" alignSelf="center" flexGrow={1} justifyContent="center">
        <Flex
          direction="column"
          justifyContent={{ base: 'flex-start ', md: 'center' }}
          flexGrow={1}
          maxW={600}
          p={{
            base: 0,
            sm: 8,
          }}
        >
          <Box mb={2}>
            <Heading color={titleColor} mb={2}>
              Reset your password
            </Heading>
            <Text fontSize="sm" color={textColor}>
              Enter the email address you signed up with and we'll send you instructions as how to reset your password.
              Or go back to{' '}
              <Link
                color={linkColor}
                textDecoration="underline"
                textUnderlineOffset={1.5}
                to="/sign-in"
                as={RouterLink}
              >
                sign in page
              </Link>
              .
            </Text>
          </Box>
          <SoftCard mt={2}>
            <ResetPasswordForm onSubmit={onSubmit} />
          </SoftCard>
        </Flex>
      </Flex>
    </DefaultLayout>
  );
};
