const Client = require('./lib/client');
const dg = require('./lib/data-generator');

createData();

async function createData() {
  const client = new Client();
  await client.login();
  let course = await client.createCourse(dg.course('cl'));
  let files = ['/Users/cwang/power'];
  let assignment = await client.createAssignment(course.id, dg.assignment(), files);
  let user = await client.createUser(dg.user('cw'));
  await client.enroll(course.id, user.id, 'S');
  await client.logout();
  await client.login(user);
  client.createAssignmentSubmission(course.id, assignment.id, dg.assignmentSubmission(), files);
}
