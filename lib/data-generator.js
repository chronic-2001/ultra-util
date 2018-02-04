const _ = require('lodash');

function createGenerator(prefixes, defaults) {
  let seq = 0;
  return function (token, overrides) {
    token = token + ++seq;
    return {
      ..._.mapValues(prefixes, pre => pre + (pre && '_') + token),
      ...defaults,
      ...overrides
    };
  }
}

module.exports = {
  user: createGenerator({
    givenName: 'given_name',
    familyName: 'family_name',
    userName: '',
    password: ''
  }),

  course: createGenerator(
    {
      name: 'course',
      courseId: 'course'
    },
    {
      isAvailable: true,
      isOrganization: false
    }
  ),

  assignment: createGenerator(
    {
      contentName: 'assignment',
    },
    {
      method: 'add',
      content_color: '#000000',
      content_desc_text: '<p>instructions</p>',
      possible: 100,
      assignmentType: 'I',
      attemptType: 'SINGLE_ATTEMPT',
      isAvailable: 'true' // formData cannot handle boolean type
    }
  ),

  assignmentSubmission: createGenerator(
    {},
    {
      isAjaxSubmit: 'true',
      dispatch: 'submit',
      'studentSubmission.text': '<p>submission text</p>',
      'student_commentstext': 'comments',
    }
  ),
};
