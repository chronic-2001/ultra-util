const _request = require('request-promise-native');
const cheerio = require('cheerio');
const _ = require('lodash');
const dg = require('./data-generator');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://mylearn.int.bbpd.io';
const REST_PREFIX = '/learn/api';
const REST_VERSION = '/v1';
const REST_URL = BASE_URL + REST_PREFIX + REST_VERSION;
const LOGIN_URL = BASE_URL + '/webapps/login/';
const USER_URL = REST_URL + '/users';
const COURSE_URL = REST_URL + '/courses';

const NONCE = 'blackboard.platform.security.NonceUtil.nonce';
const NONCE_AJAX = 'blackboard.platform.security.NonceUtil.nonce.ajax';
const XSRF = 'X-Blackboard-XSRF';
const ADMIN = { userName: 'administrator', password: 'changeme' };

function request() {
  return parseResponse(_request.apply(this, arguments));
}

_.extend(request, _request);

['get', 'head', 'post', 'put', 'patch', 'del', 'delete'].forEach(method => {
  request[method] = function () {
    return parseResponse(_request[method].apply(this, arguments));
  }
});

async function parseResponse(request) {
  const response = await request;
  if (response.statusCode >= 400) {
    throw new Error(response.statusCode + ': ' + (_.isObject(response.body) ? JSON.stringify(response.body) : response.body));
  } else if (response.statusCode >= 300) {
    return response;
  } else {
    return response.body;
  }
}

class Client {
  constructor(defaults) {
    this.jar = request.jar();
    this.request = request.defaults({ jar: this.jar, simple: false, resolveWithFullResponse: true, ...defaults });
  }
  async login({ userName, password } = ADMIN) {
    const response = await this.request.post({
      url: LOGIN_URL,
      form: {
        user_id: userName,
        action: 'login',
        password: password,
        [NONCE]: await this.getNonceValue(BASE_URL)
      }
    });
    if (response.statusCode !== 302) {
      throw new Error('Login failed: ' + cheerio.load(response.body)('#loginErrorMessage').text());
    }

    this.xsrf = (await this.request.get(REST_URL + '/utilities/xsrfToken', { json: true })).xsrfToken;
    this.rest = this.request.defaults({ headers: { [XSRF]: this.xsrf }, json: true });
  }

  logout() {
    return this.request.get(LOGIN_URL, { qs: { action: 'logout' } });
  }

  async getNonceValue(url) {
    const response = await this.request.get(url);
    const $ = cheerio.load(response);
    return $(`form>input[name="${NONCE}"]`).val();
  }

  async createUser(user) {
    return { ... await this.rest.post(USER_URL, { body: user }), password: user.password };
  }

  createCourse(course) {
    return this.rest.post(COURSE_URL, { body: course });
  }

  enroll(courseId, userId, role) {
    return this.rest.post(`${COURSE_URL}/${courseId}/memberships`,
      {
        body: {
          courseId: courseId,
          userId: userId,
          role: role,
          isAvailable: true
        }
      })
  }

  async createAssignment(courseId, assignment, ...files) {
    let r = await this.rest.get(`${COURSE_URL}/${courseId}/contents`,
      { qs: { q: 'Content', contentHandler: 'resource/x-bb-folder', fields: 'id' } });
    let parentId = r.results[0].id;
    return this.request.post(
      {
        url: BASE_URL + '/webapps/assignment/execute/manageAssignment',
        formData: {
          [NONCE_AJAX]: this.xsrf,
          course_id: courseId,
          parent_id: parentId,
          content_id: parentId,
          ...assignment,
          ...this.assembleFiles(files)
        }
      });
  }

  async createAssignmentSubmission(courseId, contentId, submission, ...files) {
    return this.request.post(
      {
        url: BASE_URL + '/webapps/assignment/uploadAssignment?action=submit',
        formData: {
          [NONCE]: await this.getNonceValue(BASE_URL + `/webapps/assignment/uploadAssignment?content_id=${contentId}&course_id=${courseId}&group_id=&mode=view`),
          [NONCE_AJAX]: this.xsrf,
          course_id: courseId,
          content_id: contentId,
          ...submission,
          ...this.assembleFiles(files)
        }
      });
  }

  assembleFiles(files) {
    return files && files.length ? files.reduce((obj, file, index) => {
      obj['newFile_LocalFile' + index] = fs.createReadStream(file);
      obj.newFile_linkTitle.push(path.basename(file));
      obj.newFile_attachmentType.push('L');
      return obj;
    }, { newFile_linkTitle: [], newFile_attachmentType: [] }) : null;
  }
}

module.exports = Client;
