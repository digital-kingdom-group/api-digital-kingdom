<?php

  ini_set( 'display_errors', 1 );
  error_reporting( E_ALL );
  $from = "test@hostinger-tutorials.com";
  $to = $_GET['destino'];
  $subject = "TRON INFORMATION";
  $headers = "From:" . $from;
  $headers = "MIME-Version: 1.0" . "\r\n";
  $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
  $message = $_GET['html'];
  if ("crypto2021" == $_GET['token']) {
      mail($to,$subject,$message, $headers);
      echo "{result: true}";
  }else{
      echo "{false: false}";
  }
    
?>