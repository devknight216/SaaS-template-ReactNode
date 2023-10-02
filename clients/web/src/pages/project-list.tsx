import { Text, Heading, Icon, Badge, Box, SimpleGrid } from '@chakra-ui/react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetRecoilState, useRecoilValue } from 'recoil';
import { MdAdd, MdGroup, MdWork } from 'react-icons/md';

import { AuthenticatedLayout } from '../layouts';
import { selectedProjectSelector, currentUserState, projectsState } from '../state';
import { Project } from '../types';
import { InactiveProjectDialog } from '../components/projects/InactiveProjectDialog';
import { PageHeading } from '../components/generic/PageHeading';
import { SoftCard } from '../components/generic/SoftCard';

const cardStyle = {
  minHeight: '180px',
  cursor: 'pointer',
};

export const ProjectListPage: React.FC = () => {
  const navigate = useNavigate();
  const [inactiveProjectId, setInactiveProjectId] = useState<string | null>(null);
  const setSelectedProject = useSetRecoilState(selectedProjectSelector);
  const projects = useRecoilValue(projectsState);
  const user = useRecoilValue(currentUserState);

  useEffect(() => {
    if (projects.length === 0) {
      navigate('/projects/create');
    }
  }, [projects, navigate]);

  const onSelectProject = (project: Project) => {
    setSelectedProject(project);
    navigate(`/projects/${project.id}/dashboard`);
  };

  const ProjectCard = ({ project }: { project: Project }) => (
    <SoftCard
      key={project.id}
      style={{ ...cardStyle, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
      onClick={() =>
        project.admin.has_active_subscription ? onSelectProject(project) : setInactiveProjectId(project.id)
      }
    >
      <Box textAlign={['center', 'left']}>
        <Heading size="md">{project.name}</Heading>
        <Badge variant={project.admin.has_active_subscription ? 'solid' : 'subtle'}>
          {project.admin.has_active_subscription ? 'Active' : 'Inactive'}
        </Badge>
      </Box>
      <Box display="flex" flexDir="row">
        <Icon as={MdGroup} boxSize="24px" />
        <Text ml="2">{project.users?.length}</Text>
      </Box>
      {user && !project.admin.has_active_subscription && (
        <InactiveProjectDialog
          isOpen={inactiveProjectId === project.id}
          onClose={() => setInactiveProjectId(null)}
          project={project}
          user={user}
        />
      )}
    </SoftCard>
  );

  return (
    <AuthenticatedLayout sidebar={false}>
      <PageHeading title="Projects" icon={MdWork} />
      <Box mt={8} />
      <SimpleGrid minChildWidth="200px" width="100%" spacingX="40px" spacingY="20px">
        {user && projects && projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        <SoftCard
          onClick={() => navigate('/projects/create')}
          style={{
            ...cardStyle,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon boxSize="48px" as={MdAdd} />
          <Heading as="h3" size="sm" textAlign="center">
            Create Project
          </Heading>
        </SoftCard>
      </SimpleGrid>
    </AuthenticatedLayout>
  );
};
