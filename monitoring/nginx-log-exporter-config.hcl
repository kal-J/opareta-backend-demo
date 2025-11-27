listen {
  port = 9114
  address = "0.0.0.0"
}

namespace "nginx" {
  # Format matches nginx log_format main - entries end with request_time value
  # New entries: end with just $request_time (e.g., 0.000)
  # Old entries in opareta-access.log: have rt=$request_time uct="..." format
  format = "$remote_addr - $remote_user [$time_local] \"$request\" $status $body_bytes_sent \"$http_referer\" \"$http_user_agent\" \"$http_x_forwarded_for\" $request_time"
  source_files = [
    "/var/log/nginx/*access.log"
  ]
  
  histogram_buckets = [.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10]
}
