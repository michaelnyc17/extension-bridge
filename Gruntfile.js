module.exports = function(grunt) {
  grunt.initConfig({
    clean: {
      build: ['build'],
      dist: ['dist']
    },
    
    uglify: {
      options: {
        preserveComments: /^!|Copyright/i  // Keeps comments with Copyright
      },
      build: {
        files: {
          'build/popup.js': 'popup.js',
          'build/matcher.js': 'matcher.js',
          'build/firefox-api.js': 'firefox-api.js',
          'build/string-similarity.js': 'string-similarity.js',
          'build/portability.js': 'portability.js'
        }
      }
    },
    
    cssmin: {
      options: {
        keepSpecialComments: 1  // Keeps first comment (your copyright)
      },
      build: {
        files: {
          'build/styles.css': 'styles.css'
        }
      }
    },
    
    htmlmin: {
      build: {
        options: {
          removeComments: false,  // Keep comments
          collapseWhitespace: true
        },
        files: {
          'build/popup.html': 'popup.html'
        }
      }
    },
    
    copy: {
      build: {
        files: [
          {
            expand: true,
            src: ['manifest.json', 'icons/**', 'LICENSE'],
            dest: 'build/'
          }
        ]
      }
    },
    
    compress: {
      dist: {
        options: {
          archive: 'dist/extension.zip'
        },
        files: [{
          expand: true,
          cwd: 'build/',
          src: ['**'],
          dest: '/'
        }]
      }
    }
  });

  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-htmlmin');
  grunt.loadNpmTasks('grunt-contrib-compress');

  grunt.registerTask('build', ['clean:build', 'uglify', 'cssmin', 'htmlmin', 'copy:build']);
  grunt.registerTask('package', ['build', 'clean:dist', 'compress:dist']);
  grunt.registerTask('default', ['build']);
};
